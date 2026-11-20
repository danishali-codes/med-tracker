/**
 * Runs optional sync. With sync off (the default), or Fully local on, none of this touches
 * the network.
 *
 * - Secrets (server sign-in, encryption keys, share codes you follow) live in the
 *   phone's secure keystore, never in the app database or its exports.
 * - Your status for caregivers is pushed a few seconds after any change.
 * - The backup is pushed a couple of minutes after changes, at most that often.
 */
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import './random';
import { formatTime, timeFromDate, toDateKey } from '../domain/dates';
import { indexLogs } from '../domain/schedule';
import * as repo from '../db/repo';
import { CHANNEL_ID } from '../notifications/reminders';
import { assertCloudAllowed, cloudAllowed } from '../privacy';
import { newKey, open, seal } from './crypto';
import * as pb from './pocketbase';
import { buildStatus, nextAlerts, parseStatus, type CareStatus } from './status';
import { accountKeys, packBackup, unpackBackup } from './vault';

/** Every request goes through here, so Fully local can't be skipped by accident. */
const f: pb.Fetch = (...a) => {
  assertCloudAllowed();
  return fetch(...a);
};

/** The server Sabr's developer runs for anyone who wants a backup without running their own. */
export const SABR_SERVER = 'https://sabr-sync.danishali.dev';
/** Longer than for your own server: this password is the only thing protecting the backup. */
export const MIN_SABR_PASSWORD = 10;

// ---- secrets ----

const SESSION = 'sync_session';
const BACKUP_KEY = 'sync_backup_key';
const SHARE_KEY = 'sync_share_key';
/** Made from your password at sign-in; unlocks the backup key. See vault.ts. */
const WRAP_KEY = 'sync_wrap_key';
const FOLLOWING = 'care_following';

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function getSession(): Promise<pb.Session | null> {
  return getJson<pb.Session>(SESSION);
}

async function setSession(s: pb.Session | null) {
  if (s) await SecureStore.setItemAsync(SESSION, JSON.stringify(s));
  else await SecureStore.deleteItemAsync(SESSION);
}

// One lookup per key at a time, so two callers never make two different keys.
const pendingKeys = new Map<string, Promise<string>>();

function keyFor(name: string): Promise<string> {
  let p = pendingKeys.get(name);
  if (!p) {
    p = (async () => {
      let k = await SecureStore.getItemAsync(name);
      if (!k) {
        k = newKey();
        await SecureStore.setItemAsync(name, k);
      }
      return k;
    })().finally(() => pendingKeys.delete(name));
    pendingKeys.set(name, p);
  }
  return p;
}

async function forgetKey(name: string) {
  await pendingKeys.get(name)?.catch(() => {});
  await SecureStore.deleteItemAsync(name);
}

/** The key that unlocks your backup. Needed to restore on a new phone; shown in Settings. */
export function backupKey(): Promise<string> {
  return keyFor(BACKUP_KEY);
}

// ---- account ----

export function isSabrServer(server: string | null | undefined): boolean {
  return !!server && server.replace(/\/+$/, '') === SABR_SERVER;
}

/**
 * Signs in or makes an account. The password itself is never sent: the server gets a code
 * made from it, and the phone keeps a second code that unlocks the backup.
 *
 * Accounts made on your own server before 0.10 used the plain password; signing in to those
 * still works (that server is yours), they just need the recovery key to restore.
 */
export async function connect(server: string, email: string, password: string, create: boolean): Promise<pb.Session> {
  const sabr = isSabrServer(server);
  if (sabr && password.length < MIN_SABR_PASSWORD) throw new Error(`Use a password of at least ${MIN_SABR_PASSWORD} characters.`);
  const keys = await accountKeys(email, password);
  let s: pb.Session;
  let wrap: string | null = keys.wrap;
  if (create) {
    try {
      s = await pb.signUp(f, server, email, keys.auth);
    } catch (e) {
      if (e instanceof pb.SyncError && e.status === 400) throw new Error('Could not make the account. That email may already have one: try Sign in instead.');
      throw e;
    }
  } else {
    try {
      s = await pb.signIn(f, server, email, keys.auth);
    } catch (e) {
      if (sabr || !(e instanceof pb.SyncError) || e.status !== 400) throw e;
      s = await pb.signIn(f, server, email, password);
      wrap = null;
    }
  }
  if (wrap) await SecureStore.setItemAsync(WRAP_KEY, wrap);
  else await SecureStore.deleteItemAsync(WRAP_KEY);
  await setSession(s);
  return s;
}

/** True when your password can unlock server backups (accounts made from 0.10 on). */
export async function hasPasswordUnlock(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(WRAP_KEY));
}

/** Signs out and stops sharing. Your server copy is deleted too if `wipe` is set. */
export async function disconnect(wipe: boolean) {
  const s = await getSession();
  if (s && wipe) {
    // If a delete fails, stay signed in and keep the ids so it can be tried again.
    for (const k of ['backup_id', 'share_id']) {
      const id = repo.getKv(k);
      if (!id) continue;
      try {
        await pb.deleteVault(f, s, id);
      } catch (e) {
        throw new Error(`Could not delete your copy on the server, so you are still signed in. ${e instanceof Error ? e.message : ''}`.trim());
      }
      repo.deleteKv(k);
    }
  }
  // Signing out always tries to take down your shared status, so old codes show nothing stale.
  const shareId = repo.getKv('share_id');
  if (s && shareId && !wipe) await pb.deleteVault(f, s, shareId).catch(() => {});
  repo.deleteKv('backup_id');
  repo.deleteKv('share_id');
  await forgetKey(SHARE_KEY);
  await SecureStore.deleteItemAsync(WRAP_KEY);
  await setSession(null);
  const st = repo.getSettings();
  repo.saveSettings({ ...st, sync: { ...st.sync, enabled: false, backup: false, share: false } });
}

async function withSession<T>(fn: (s: pb.Session) => Promise<T>): Promise<T | null> {
  const s = await getSession();
  if (!s) return null;
  try {
    return await fn(s);
  } catch (e) {
    if (e instanceof pb.SyncError && (e.status === 401 || e.status === 403)) repo.setKv('sync_error', e.message, false);
    throw e;
  }
}

// ---- pushing ----

function record(key: 'last_backup' | 'last_share', err?: unknown) {
  if (err) repo.setKv('sync_error', err instanceof Error ? err.message : String(err), false);
  else {
    repo.setKv(key, new Date().toISOString(), false);
    repo.deleteKv('sync_error');
  }
}

export async function pushShare(): Promise<void> {
  const st = repo.getSettings();
  if (!st.sync.enabled || !st.sync.share || !cloudAllowed()) return;
  try {
    const done = await withSession(async (s) => {
      const now = new Date();
      const today = toDateKey(now);
      const status = buildStatus({
        meds: repo.getMeds(),
        logs: indexLogs(repo.getLogs(toDateKey(new Date(now.getTime() - 9 * 86400_000)), today)),
        today,
        now,
        name: st.sync.shareAs.trim() || 'Someone',
        showNames: st.sync.shareNames,
      });
      const data = seal(JSON.stringify(status), await keyFor(SHARE_KEY));
      const id = await pb.putVault(f, s, 'share', data, repo.getKv('share_id'));
      if (id !== repo.getKv('share_id')) repo.setKv('share_id', id, false);
      return true;
    });
    if (done) record('last_share');
  } catch (e) {
    record('last_share', e);
  }
}

export async function pushBackup(): Promise<void> {
  const st = repo.getSettings();
  if (!st.sync.enabled || !st.sync.backup || !cloudAllowed()) return;
  try {
    const done = await withSession(async (s) => {
      const data = packBackup(repo.exportAll(), await backupKey(), await SecureStore.getItemAsync(WRAP_KEY));
      const id = await pb.putVault(f, s, 'backup', data, repo.getKv('backup_id'));
      if (id !== repo.getKv('backup_id')) repo.setKv('backup_id', id, false);
      return true;
    });
    if (done) record('last_backup');
  } catch (e) {
    record('last_backup', e);
  }
}

interface FoundBackup {
  id: string;
  updated: string;
  json: string;
  backupKey: string;
}

/**
 * The newest backup on the server that opens with the recovery key, or (without one) with
 * your password. There can be more than one, say a new phone started its own before restoring.
 */
async function findBackup(recoveryKey: string | null): Promise<FoundBackup | null> {
  const s = await getSession();
  if (!s) throw new Error('Sign in first.');
  const wrap = await SecureStore.getItemAsync(WRAP_KEY);
  for (const v of await pb.listVaults(f, s, 'backup')) {
    try {
      const { json, backupKey } = unpackBackup(v.data, { recoveryKey, wrap });
      // Skip the empty backup this phone may have made before restoring.
      if (v.id === repo.getKv('backup_id') && !recoveryKey) continue;
      return { id: v.id, updated: v.updated, json, backupKey };
    } catch {
      // Not this one.
    }
  }
  return null;
}

/** When the newest backup your password opens was made, if there is one. For "Restore?" after signing in. */
export async function backupOnServer(): Promise<string | null> {
  if (!(await hasPasswordUnlock())) return null;
  return (await findBackup(null))?.updated ?? null;
}

/** Replaces everything on this phone with your server backup. Without a recovery key, your password unlocks it. */
export async function restoreBackup(recoveryKey: string | null): Promise<void> {
  const found = await findBackup(recoveryKey?.trim() || null);
  if (!found) {
    throw new Error(
      recoveryKey?.trim()
        ? 'This recovery key does not open any backup on this server. Check the key.'
        : 'No backup that your password opens was found. If it was made before 0.10, use your recovery key.',
    );
  }
  const keep = repo.getSettings().sync;
  repo.importAll(found.json);
  await forgetKey(BACKUP_KEY);
  await SecureStore.setItemAsync(BACKUP_KEY, found.backupKey);
  repo.setKv('backup_id', found.id, false);
  const st = repo.getSettings();
  repo.saveSettings({ ...st, sync: { ...keep, enabled: true } });
}

/** The code to give a caregiver. Starts sharing if it hasn't yet. */
export async function shareCode(): Promise<string | null> {
  await pushShare();
  const s = await getSession();
  const id = repo.getKv('share_id');
  if (!s || !id) return null;
  return pb.makeShareCode({ server: s.server, id, key: await keyFor(SHARE_KEY) });
}

/** Makes a new share key and record, so old codes stop working. */
export async function resetShare() {
  const s = await getSession();
  const id = repo.getKv('share_id');
  if (id) {
    if (!s) throw new Error('Sign in to your server first, so the old code can be removed.');
    // Throws if the server can't be reached; the old id and key are kept so this can be retried.
    await pb.deleteVault(f, s, id);
  }
  repo.deleteKv('share_id');
  await forgetKey(SHARE_KEY);
  await pushShare();
}

// ---- following someone ----

export interface Followed {
  code: pb.ShareCode;
  status: CareStatus | null;
  checkedAt: string | null;
  error?: string;
}

type CareListener = () => void;
const careListeners = new Set<CareListener>();
let following: Followed[] | null = null;

export function subscribeCare(l: CareListener) {
  careListeners.add(l);
  return () => careListeners.delete(l);
}

const NONE: Followed[] = [];
/** The people you follow as last loaded, for rendering. Call getFollowing() once to load. */
export function followingSnapshot(): Followed[] {
  return following ?? NONE;
}

export async function getFollowing(): Promise<Followed[]> {
  if (!following) {
    // Codes (with their keys) sit in the secure keystore; the last statuses we fetched in the app database.
    const codes = (await getJson<pb.ShareCode[]>(FOLLOWING)) ?? [];
    const cached = JSON.parse(repo.getKv('care_status') ?? '{}') as Record<string, Omit<Followed, 'code'>>;
    following = codes.map((code) => {
      const c = cached[code.id];
      return { code, status: c?.status ?? null, checkedAt: c?.checkedAt ?? null, error: c?.error };
    });
    careListeners.forEach((l) => l());
  }
  return following;
}

async function setFollowing(list: Followed[]) {
  following = list;
  await SecureStore.setItemAsync(FOLLOWING, JSON.stringify(list.map((x) => x.code)));
  const cached = Object.fromEntries(list.map(({ code, ...rest }) => [code.id, rest]));
  repo.setKv('care_status', JSON.stringify(cached), false);
  careListeners.forEach((l) => l());
}

export async function follow(text: string): Promise<Followed> {
  const code = pb.parseShareCode(text);
  const item = await check({ code, status: null, checkedAt: null });
  if (!item.status) throw new Error(item.error ?? 'Could not read this share.');
  const list = (await getFollowing()).filter((x) => x.code.id !== code.id);
  await setFollowing([...list, item]);
  await scheduleCareAlerts();
  return item;
}

export async function unfollow(id: string) {
  await setFollowing((await getFollowing()).filter((x) => x.code.id !== id));
  await scheduleCareAlerts();
}

async function check(item: Followed): Promise<Followed> {
  try {
    const r = await pb.getShared(f, item.code.server, item.code.id);
    const status = parseStatus(open(r.data, item.code.key));
    return { ...item, status, checkedAt: new Date().toISOString(), error: undefined };
  } catch (e) {
    const msg = e instanceof pb.SyncError && e.status === 404 ? 'They stopped sharing, or made a new code.' : e instanceof Error ? e.message : String(e);
    return { ...item, checkedAt: new Date().toISOString(), error: msg };
  }
}

export async function refreshFollowing(): Promise<void> {
  const list = await getFollowing();
  if (list.length === 0 || !cloudAllowed()) return;
  await setFollowing(await Promise.all(list.map(check)));
  await scheduleCareAlerts();
}

/**
 * Local notifications for doses the people you follow haven't marked yet. Planned from
 * the last status we fetched, so the text says "may not" until the app checks again.
 */
export async function scheduleCareAlerts() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter((n) => n.identifier.startsWith('care-')).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const st = repo.getSettings();
  if (!st.care.alerts) return;
  const now = new Date();
  for (const p of await getFollowing()) {
    if (!p.status) continue;
    for (const { at, dose } of nextAlerts(p.status, now, st.care.graceMinutes).slice(0, 10)) {
      const due = formatTime(timeFromDate(new Date(dose.due)));
      await Notifications.scheduleNotificationAsync({
        identifier: `care-${p.code.id}-${dose.due}`,
        content: {
          title: `${p.status.name} may have missed a dose`,
          body: `${dose.label} was due at ${due} and wasn't marked when last checked. Open to check again.`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
      });
    }
  }
}

// ---- running ----

let shareTimer: ReturnType<typeof setTimeout> | null = null;
let backupTimer: ReturnType<typeof setTimeout> | null = null;
let stop: (() => void) | null = null;

/** Starts listening for changes. Safe to call more than once. */
export function startSync() {
  if (stop) return;
  stop = repo.subscribe(() => {
    const st = repo.getSettings();
    if (!st.sync.enabled || st.fullyLocal) return;
    if (st.sync.share) {
      if (shareTimer) clearTimeout(shareTimer);
      shareTimer = setTimeout(() => void pushShare(), 5_000);
    }
    if (st.sync.backup && !backupTimer) {
      backupTimer = setTimeout(() => {
        backupTimer = null;
        void pushBackup();
      }, 120_000);
    }
  });
}

/** One pass of everything that is turned on. Used on app open and by the background task. */
export async function syncNow(): Promise<void> {
  if (!cloudAllowed()) return;
  const st = repo.getSettings();
  if (st.sync.enabled) {
    const s = await getSession();
    if (s) {
      try {
        await setSession(await pb.refresh(f, s));
      } catch {
        // Reported by the push below if the session really is gone.
      }
    }
    await pushShare();
    await pushBackup();
  }
  await refreshFollowing();
}

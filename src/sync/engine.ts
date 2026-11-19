/**
 * Runs optional sync. With sync off (the default) none of this touches the network.
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
import { newKey, open, seal } from './crypto';
import * as pb from './pocketbase';
import { buildStatus, nextAlerts, parseStatus, type CareStatus } from './status';

const f: pb.Fetch = (...a) => fetch(...a);

// ---- secrets ----

const SESSION = 'sync_session';
const BACKUP_KEY = 'sync_backup_key';
const SHARE_KEY = 'sync_share_key';
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

async function keyFor(name: string): Promise<string> {
  let k = await SecureStore.getItemAsync(name);
  if (!k) {
    k = newKey();
    await SecureStore.setItemAsync(name, k);
  }
  return k;
}

/** The key that unlocks your backup. Needed to restore on a new phone; shown in Settings. */
export function backupKey(): Promise<string> {
  return keyFor(BACKUP_KEY);
}

// ---- account ----

export async function connect(server: string, email: string, password: string, create: boolean): Promise<pb.Session> {
  const s = create ? await pb.signUp(f, server, email, password) : await pb.signIn(f, server, email, password);
  await setSession(s);
  return s;
}

/** Signs out and stops sharing. Your server copy is deleted too if `wipe` is set. */
export async function disconnect(wipe: boolean) {
  const s = await getSession();
  if (s && wipe) {
    for (const k of ['backup_id', 'share_id']) {
      const id = repo.getKv(k);
      if (id) await pb.deleteVault(f, s, id).catch(() => {});
    }
  }
  repo.deleteKv('backup_id');
  repo.deleteKv('share_id');
  await SecureStore.deleteItemAsync(SHARE_KEY);
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
  if (!st.sync.enabled || !st.sync.share) return;
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
  if (!st.sync.enabled || !st.sync.backup) return;
  try {
    const done = await withSession(async (s) => {
      const data = seal(repo.exportAll(), await backupKey());
      const id = await pb.putVault(f, s, 'backup', data, repo.getKv('backup_id'));
      if (id !== repo.getKv('backup_id')) repo.setKv('backup_id', id, false);
      return true;
    });
    if (done) record('last_backup');
  } catch (e) {
    record('last_backup', e);
  }
}

/** Replaces everything on this phone with your server backup. */
export async function restoreBackup(key: string): Promise<void> {
  const s = await getSession();
  if (!s) throw new Error('Sign in to your server first.');
  const v = await pb.findVault(f, s, 'backup');
  if (!v) throw new Error('No backup on this server yet.');
  const json = open(v.data, key.trim());
  const keep = repo.getSettings().sync;
  repo.importAll(json);
  await SecureStore.setItemAsync(BACKUP_KEY, key.trim());
  repo.setKv('backup_id', v.id, false);
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
  if (s && id) await pb.deleteVault(f, s, id).catch(() => {});
  repo.deleteKv('share_id');
  await SecureStore.deleteItemAsync(SHARE_KEY);
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
  if (list.length === 0) return;
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
    if (!st.sync.enabled) return;
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

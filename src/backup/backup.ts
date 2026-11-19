import '../sync/random';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { diffDays, toDateKey } from '../domain/dates';
import * as repo from '../db/repo';
import { isLockedBackup, lockBackup, unlockBackup } from './crypto';

// Backups are files you keep yourself: shared to wherever you like (Files, Google Drive,
// a USB stick) or written once a week to a folder you picked. Nothing is uploaded by the app.

const AUTO_PASSWORD = 'auto_backup_password';
const LAST_AUTO = 'last_backup_auto';
const KEEP_AUTO_FILES = 4;
const PREFIX = 'sabr-backup-';

function backupFileName(locked: boolean, date = new Date()): string {
  return `${PREFIX}${toDateKey(date)}${locked ? '.sabr' : '.json'}`;
}

/** The backup as text: locked with the password, or plain JSON when there's none. */
function makeBackup(password: string | null): string {
  const plain = repo.exportAll();
  return password ? lockBackup(plain, password) : plain;
}

/** Saves a backup to the cache and opens the share sheet so it can go anywhere. */
export async function shareBackup(password: string | null) {
  const locked = !!password;
  const file = new File(Paths.cache, backupFileName(locked));
  if (file.exists) file.delete();
  file.create();
  file.write(makeBackup(password));
  await Sharing.shareAsync(file.uri, { mimeType: locked ? 'application/octet-stream' : 'application/json', dialogTitle: 'Save your backup' });
}

export function needsPassword(text: string): boolean {
  return isLockedBackup(text);
}

/** Replaces everything in the app with the backup. Throws a readable message on failure. */
export function restoreBackup(text: string, password: string | null) {
  const plain = isLockedBackup(text) ? unlockBackup(text, password ?? '') : text;
  repo.importAll(plain);
}

// ---- weekly backup to a folder ----

export async function pickBackupFolder(): Promise<{ uri: string; name: string } | null> {
  try {
    const dir = await Directory.pickDirectoryAsync();
    if (!dir) return null;
    const name = dir.name || decodeURIComponent(dir.uri.split('/').pop() ?? '').replace(/^primary:/, '') || 'Chosen folder';
    return { uri: dir.uri, name };
  } catch (e) {
    if (String(e).toLowerCase().includes('cancel')) return null;
    throw e;
  }
}

export async function setAutoBackupPassword(password: string | null) {
  if (password) await SecureStore.setItemAsync(AUTO_PASSWORD, password);
  else await SecureStore.deleteItemAsync(AUTO_PASSWORD);
}

export async function hasAutoBackupPassword(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(AUTO_PASSWORD));
}

export function lastAutoBackup(): string | null {
  return repo.getKv(LAST_AUTO);
}

/** Writes a backup to the chosen folder now, and keeps only the newest few there. */
export async function runAutoBackup(): Promise<void> {
  const s = repo.getSettings().autoBackup;
  if (!s.folderUri) throw new Error('Choose a folder first.');
  const password = await SecureStore.getItemAsync(AUTO_PASSWORD);
  if (!password) throw new Error('Set a backup password first.');
  const dir = new Directory(s.folderUri);
  const name = backupFileName(true);
  const old = dir.list().filter((x): x is File => x instanceof File && (x.name ?? '').startsWith(PREFIX));
  for (const f of old) if (f.name === name) f.delete();
  const file = dir.createFile(name, 'application/octet-stream');
  file.write(makeBackup(password));
  const rest = old.filter((f) => f.name !== name && f.exists).sort((a, b) => ((a.name ?? '') < (b.name ?? '') ? 1 : -1));
  for (const f of rest.slice(KEEP_AUTO_FILES - 1)) {
    try {
      f.delete();
    } catch {
      // A file someone else made read-only; leave it.
    }
  }
  repo.setKv(LAST_AUTO, new Date().toISOString());
}

/** Runs the weekly backup when it's due. Quiet on failure; Settings shows the last good one. */
export async function autoBackupIfDue(now = new Date()): Promise<boolean> {
  const s = repo.getSettings().autoBackup;
  if (!s.enabled || !s.folderUri) return false;
  const last = lastAutoBackup();
  if (last && diffDays(toDateKey(new Date(last)), toDateKey(now)) < s.everyDays) return false;
  try {
    await runAutoBackup();
    return true;
  } catch (e) {
    repo.setKv('last_backup_error', String(e instanceof Error ? e.message : e), false);
    return false;
  }
}

import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import * as repo from '../db/repo';
import { assertCloudAllowed } from '../privacy';

/**
 * Optional backups to your own Google Drive. You sign in with Google only for this, and
 * Sabr asks for the narrowest Drive permission there is (drive.file): it can see and change
 * only the files it made itself, in a folder called "Sabr backups", and nothing else in
 * your Drive. Every file is locked with your backup password on the phone before upload,
 * so Google stores it but can't read it.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_NAME = 'Sabr backups';
const FOLDER_TYPE = 'application/vnd.google-apps.folder';
const ACCOUNT = 'drive_account';
const FOLDER = 'drive_folder';

let configured = false;
function setup() {
  if (configured) return;
  // No web client id: Sabr has no server of its own here, it only needs an access token on the phone.
  GoogleSignin.configure({ scopes: [SCOPE] });
  configured = true;
}

/** The Google account backups go to, or null when Drive isn't connected. */
export function driveAccount(): string | null {
  return repo.getKv(ACCOUNT);
}

/** Opens Google's sign-in. Returns the account's email, or null if you backed out. */
export async function connectDrive(): Promise<string | null> {
  assertCloudAllowed();
  setup();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const r = await GoogleSignin.signIn();
    if (r.type !== 'success') return null;
    if (!r.data.scopes.includes(SCOPE)) {
      const more = await GoogleSignin.addScopes({ scopes: [SCOPE] });
      if (!more) return null;
    }
    repo.setKv(ACCOUNT, r.data.user.email);
    repo.deleteKv(FOLDER);
    return r.data.user.email;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return null;
    if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services are needed to sign in with Google.');
    // DEVELOPER_ERROR: this build's signing key isn't registered with Google for Sabr.
    if (isErrorWithCode(e) && String(e.code) === '10') throw new Error("Google sign-in isn't set up for this copy of Sabr. Install the official release from the Sabr website.");
    throw new Error(`Google sign-in didn't work. ${e instanceof Error ? e.message : String(e)}`.trim());
  }
}

/** Signs out of Google and takes back Sabr's access. Backups already in Drive stay there. */
export async function disconnectDrive(): Promise<void> {
  setup();
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // Offline, or already revoked from the Google account page.
  }
  try {
    await GoogleSignin.signOut();
  } catch {
    // Nothing to sign out of.
  }
  repo.deleteKv(ACCOUNT);
  repo.deleteKv(FOLDER);
  const st = repo.getSettings();
  if (st.autoBackup.target === 'drive') repo.saveSettings({ ...st, autoBackup: { ...st.autoBackup, enabled: false } });
}

async function accessToken(): Promise<string> {
  assertCloudAllowed();
  setup();
  if (!driveAccount() || !GoogleSignin.hasPreviousSignIn()) throw new Error('Connect Google Drive first.');
  await GoogleSignin.signInSilently();
  return (await GoogleSignin.getTokens()).accessToken;
}

/** A Drive API call, retrying once with a fresh token if Google says the old one expired. */
async function drive(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = await accessToken();
  assertCloudAllowed();
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error('Could not reach Google Drive. Check your connection.');
  }
  if (res.status === 401 && !retried) {
    await GoogleSignin.clearCachedAccessToken(token);
    return drive(url, init, true);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 403 && body.includes('storageQuota')) throw new Error('Your Google Drive is full.');
    throw new Error(`Google Drive said no (${res.status}).`);
  }
  return res;
}

const q = (s: string) => encodeURIComponent(s);

async function folderId(): Promise<string> {
  const saved = repo.getKv(FOLDER);
  if (saved) return saved;
  // drive.file only lists what Sabr made, so this finds Sabr's own folder (say, from before a reinstall).
  const found = (await (
    await drive(`${API}?q=${q(`name = '${FOLDER_NAME}' and mimeType = '${FOLDER_TYPE}' and trashed = false`)}&fields=files(id)&spaces=drive`)
  ).json()) as { files: { id: string }[] };
  let id = found.files[0]?.id;
  if (!id) {
    const made = (await (
      await drive(`${API}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_TYPE }) })
    ).json()) as { id: string };
    id = made.id;
  }
  repo.setKv(FOLDER, id, false);
  return id;
}

export interface DriveBackup {
  id: string;
  name: string;
  createdTime: string;
}

/** Sabr's backups in your Drive, newest first. */
export async function listDriveBackups(): Promise<DriveBackup[]> {
  const parent = await folderId();
  const r = (await (
    await drive(`${API}?q=${q(`'${parent}' in parents and trashed = false`)}&orderBy=createdTime desc&fields=files(id,name,createdTime)&pageSize=50`)
  ).json()) as { files: DriveBackup[] };
  return r.files;
}

/** Uploads one locked backup file, then keeps only the newest `keep` (when given). */
export async function uploadToDrive(name: string, text: string, keep?: number): Promise<void> {
  const parent = await folderId();
  const boundary = `sabr${Date.now().toString(36)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: [parent], mimeType: 'application/octet-stream' }) +
    `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${text}\r\n--${boundary}--`;
  await drive(`${UPLOAD}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (keep) {
    const all = await listDriveBackups();
    for (const old of all.slice(keep)) await drive(`${API}/${old.id}`, { method: 'DELETE' }).catch(() => {});
  }
}

export async function downloadFromDrive(id: string): Promise<string> {
  return (await drive(`${API}/${encodeURIComponent(id)}?alt=media`)).text();
}

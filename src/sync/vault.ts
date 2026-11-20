import nacl from 'tweetnacl';
import { pbkdf2Fast } from '../backup/crypto';
import { open, seal, toB64, utf8 } from './crypto';

/**
 * Account keys and the backup envelope for server backups.
 *
 * Your password never goes to the server. On the phone it is stretched (PBKDF2-SHA512)
 * into 64 bytes: the first half signs you in, the second half (the "wrap key") locks your
 * backup's own random key. The server only ever sees the sign-in half, which can't be
 * turned back into the password or the wrap key. So whoever runs the server, Sabr's own
 * included, stores your backup but can't open it.
 *
 * You can restore with either your password (on any phone) or your recovery key.
 */

/** About half a second natively. Fixed: signing in on a new phone must make the same keys. */
export const ACCOUNT_ITERATIONS = 200_000;

export interface AccountKeys {
  /** Sent to the server as the account password. */
  auth: string;
  /** Stays on the phone; locks and unlocks the backup key. */
  wrap: string;
}

export async function accountKeys(email: string, password: string, iterations = ACCOUNT_ITERATIONS): Promise<AccountKeys> {
  // The salt has to be known before signing in, so it comes from the email.
  const salt = nacl.hash(utf8.encode(`sabr-account-v1:${email.trim().toLowerCase()}`)).slice(0, 16);
  const master = await pbkdf2Fast(password, salt, iterations, 64);
  return { auth: toB64(master.slice(0, 32)), wrap: toB64(master.slice(32, 64)) };
}

interface Envelope {
  sabr: 'vault';
  v: 2;
  /** The backup key, locked with the wrap key. */
  key: string;
  /** The backup, locked with the backup key. */
  data: string;
}

/** What goes to the server. Without a wrap key (older accounts) it is the bare locked backup. */
export function packBackup(json: string, backupKey: string, wrap: string | null): string {
  if (!wrap) return seal(json, backupKey);
  const env: Envelope = { sabr: 'vault', v: 2, key: seal(backupKey, wrap), data: seal(json, backupKey) };
  return JSON.stringify(env);
}

/**
 * Opens a server backup with the recovery key, or with the wrap key from your password.
 * Returns the backup and its key (so the phone keeps backing up to the same key).
 */
export function unpackBackup(stored: string, opts: { recoveryKey?: string | null; wrap?: string | null }): { json: string; backupKey: string } {
  if (stored.startsWith('{')) {
    const env = JSON.parse(stored) as Envelope;
    if (env.sabr !== 'vault' || env.v !== 2) throw new Error('This backup is from a newer version of Sabr. Update the app first.');
    const backupKey = opts.recoveryKey?.trim() || (opts.wrap ? open(env.key, opts.wrap) : null);
    if (!backupKey) throw new Error('Need your password or recovery key.');
    return { json: open(env.data, backupKey), backupKey };
  }
  const backupKey = opts.recoveryKey?.trim();
  if (!backupKey) throw new Error('This backup was made before password unlock. Use your recovery key.');
  return { json: open(stored, backupKey), backupKey };
}

import nacl from 'tweetnacl';
import { SabrCrypto } from '../../modules/sabr-crypto';
import { fromB64, open, seal, toB64, utf8 } from '../sync/crypto';

/**
 * Password-protected backup files. The password is stretched with PBKDF2-HMAC-SHA512
 * into a 32-byte key, and the backup is locked with that key (XSalsa20-Poly1305, the
 * same as sync). A wrong password or a changed file fails to open.
 */

// Stored in the file, so it can change later. The native version takes well under a second
// for 200,000 rounds; plain JavaScript (Hermes has no JIT) needs a couple of seconds for 20,000.
const KDF_ITERATIONS_NATIVE = 200_000;
const KDF_ITERATIONS_JS = 20_000;
/** Upper limit on what a file may ask for, so a damaged or hostile file cannot hang the app. */
const MAX_ITERATIONS = 200_000;

/** True when the fast native password stretching is built in (the Android app). */
export const hasNativeKdf = !!SabrCrypto;
const BLOCK = 128; // SHA-512 block size

function hmacSha512(key: Uint8Array, msg: Uint8Array): Uint8Array {
  let k = key.length > BLOCK ? nacl.hash(key) : key;
  const padded = new Uint8Array(BLOCK);
  padded.set(k);
  const inner = new Uint8Array(BLOCK + msg.length);
  const outer = new Uint8Array(BLOCK + 64);
  for (let i = 0; i < BLOCK; i++) {
    inner[i] = padded[i] ^ 0x36;
    outer[i] = padded[i] ^ 0x5c;
  }
  inner.set(msg, BLOCK);
  outer.set(nacl.hash(inner), BLOCK);
  k = nacl.hash(outer);
  return k;
}

/** PBKDF2-HMAC-SHA512, first block only (enough for a 32-byte key). */
export function pbkdf2(password: string, salt: Uint8Array, iterations: number, length = 32): Uint8Array {
  if (length > 64) throw new Error('Key too long');
  const pw = utf8.encode(password);
  const first = new Uint8Array(salt.length + 4);
  first.set(salt);
  first[salt.length + 3] = 1;
  let u = hmacSha512(pw, first);
  const t = u.slice();
  for (let i = 1; i < iterations; i++) {
    u = hmacSha512(pw, u);
    for (let j = 0; j < t.length; j++) t[j] ^= u[j];
  }
  return t.slice(0, length);
}

/** PBKDF2-HMAC-SHA512, in native code when it's there (same result, many times faster). */
export async function pbkdf2Fast(password: string, salt: Uint8Array, iterations: number, length = 32): Promise<Uint8Array> {
  if (SabrCrypto) return fromB64(await SabrCrypto.pbkdf2Sha512(toB64(utf8.encode(password)), toB64(salt), iterations, length));
  return pbkdf2(password, salt, iterations, length);
}

export interface LockedBackup {
  app: 'sabr-backup';
  version: 1;
  exportedAt: string;
  kdf: { name: 'pbkdf2-sha512'; iterations: number; salt: string };
  data: string;
}

export async function lockBackup(plainJson: string, password: string, iterations = hasNativeKdf ? KDF_ITERATIONS_NATIVE : KDF_ITERATIONS_JS): Promise<string> {
  const salt = nacl.randomBytes(16);
  const key = toB64(await pbkdf2Fast(password, salt, iterations));
  const file: LockedBackup = {
    app: 'sabr-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    kdf: { name: 'pbkdf2-sha512', iterations, salt: toB64(salt) },
    data: seal(plainJson, key),
  };
  return JSON.stringify(file);
}

export function isLockedBackup(text: string): boolean {
  try {
    return (JSON.parse(text) as { app?: string }).app === 'sabr-backup';
  } catch {
    return false;
  }
}

export async function unlockBackup(text: string, password: string): Promise<string> {
  const file = JSON.parse(text) as LockedBackup;
  if (file.app !== 'sabr-backup' || file.kdf?.name !== 'pbkdf2-sha512') throw new Error('This is not a Sabr backup file.');
  const n = file.kdf.iterations;
  if (!Number.isInteger(n) || n < 1 || n > MAX_ITERATIONS || typeof file.kdf.salt !== 'string' || typeof file.data !== 'string') {
    throw new Error('This backup file is damaged.');
  }
  const key = toB64(await pbkdf2Fast(password, fromB64(file.kdf.salt), n));
  try {
    return open(file.data, key);
  } catch {
    throw new Error('Wrong password, or the file was changed.');
  }
}

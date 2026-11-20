import { describe, expect, it } from 'vitest';
import { newKey, seal } from '../crypto';
import { accountKeys, packBackup, unpackBackup } from '../vault';

const json = JSON.stringify({ app: 'med-tracker', data: { meds: [{ name: 'Glucophage' }] } });

describe('account keys', () => {
  it('are the same on any phone for the same email and password', async () => {
    const a = await accountKeys('Me@Example.com ', 'a long password', 50);
    const b = await accountKeys('me@example.com', 'a long password', 50);
    expect(a).toEqual(b);
  });

  it('differ for another password or another email', async () => {
    const a = await accountKeys('me@example.com', 'a long password', 50);
    expect(await accountKeys('me@example.com', 'a long passwore', 50)).not.toEqual(a);
    expect((await accountKeys('you@example.com', 'a long password', 50)).auth).not.toBe(a.auth);
  });

  it('never send the password or the wrap key to the server', async () => {
    const k = await accountKeys('me@example.com', 'a long password', 50);
    expect(k.auth).not.toContain('a long password');
    expect(k.auth).not.toBe(k.wrap);
    expect(k.auth).toHaveLength(43); // 32 bytes, fits PocketBase's 71-character password limit
  });
});

describe('backup envelope', () => {
  it('opens with the password (wrap key) or the recovery key', async () => {
    const { wrap } = await accountKeys('me@example.com', 'a long password', 50);
    const backupKey = newKey();
    const stored = packBackup(json, backupKey, wrap);
    expect(stored).not.toContain('Glucophage');
    expect(stored).not.toContain(backupKey);
    expect(unpackBackup(stored, { wrap })).toEqual({ json, backupKey });
    expect(unpackBackup(stored, { recoveryKey: backupKey })).toEqual({ json, backupKey });
  });

  it('refuses the wrong password', async () => {
    const { wrap } = await accountKeys('me@example.com', 'a long password', 50);
    const other = await accountKeys('me@example.com', 'not my password', 50);
    const stored = packBackup(json, newKey(), wrap);
    expect(() => unpackBackup(stored, { wrap: other.wrap })).toThrow();
  });

  it('still opens backups from before 0.10 with the recovery key', () => {
    const backupKey = newKey();
    const old = seal(json, backupKey);
    expect(packBackup(json, backupKey, null).startsWith('v1.')).toBe(true);
    expect(unpackBackup(old, { recoveryKey: backupKey }).json).toBe(json);
    expect(() => unpackBackup(old, { wrap: newKey() })).toThrow(/recovery key/);
  });
});

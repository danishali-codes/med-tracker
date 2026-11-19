import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isLockedBackup, lockBackup, pbkdf2, unlockBackup } from '../crypto';

describe('backup encryption', () => {
  it('pbkdf2 matches the standard PBKDF2-HMAC-SHA512', () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const ours = Buffer.from(pbkdf2('correct horse', salt, 1000)).toString('hex');
    const ref = pbkdf2Sync('correct horse', Buffer.from(salt), 1000, 32, 'sha512').toString('hex');
    expect(ours).toBe(ref);
  });

  it('long passwords and non-ASCII work too', () => {
    const salt = new Uint8Array(16).fill(9);
    const pw = 'صبر'.repeat(60);
    expect(Buffer.from(pbkdf2(pw, salt, 10)).toString('hex')).toBe(pbkdf2Sync(pw, Buffer.from(salt), 10, 32, 'sha512').toString('hex'));
  });

  it('locks and unlocks a backup, and refuses the wrong password', () => {
    const plain = JSON.stringify({ app: 'med-tracker', data: { meds: [{ id: 'a' }] } });
    const locked = lockBackup(plain, 'pw1', 50);
    expect(isLockedBackup(locked)).toBe(true);
    expect(isLockedBackup(plain)).toBe(false);
    expect(locked).not.toContain('meds');
    expect(unlockBackup(locked, 'pw1')).toBe(plain);
    expect(() => unlockBackup(locked, 'pw2')).toThrow(/Wrong password/);
  });
});

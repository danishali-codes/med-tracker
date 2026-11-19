import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type DoseLog, type Medication } from '../../domain/types';
import { slotKey, setTimeRules } from '../../domain/schedule';
import { fromB64, newKey, open, seal, toB64 } from '../crypto';
import { getShared, makeShareCode, parseShareCode, putVault, signIn, type Fetch } from '../pocketbase';
import { buildStatus, nextAlerts, overdue } from '../status';

const med = (id: string, name: string, times: string[]): Medication => ({
  id,
  name,
  strength: '10 mg',
  amount: 1,
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times, startDate: '2026-11-01' },
  stock: null,
  refillAt: null,
  archived: false,
  createdAt: '2026-11-01T00:00:00Z',
});

describe('encryption', () => {
  it('round-trips text, including non-English names', () => {
    const key = newKey();
    const text = JSON.stringify({ name: 'أمي', meds: ['Panadol', 'Glucophage'] });
    const sealed = seal(text, key);
    expect(sealed).not.toContain('Panadol');
    expect(open(sealed, key)).toBe(text);
  });

  it('refuses the wrong key and tampered data', () => {
    const sealed = seal('secret', newKey());
    expect(() => open(sealed, newKey())).toThrow();
    const key = newKey();
    const good = seal('secret', key);
    const bad = good.slice(0, -2) + (good.endsWith('A') ? 'BB' : 'AA');
    expect(() => open(bad, key)).toThrow();
  });

  it('base64 round-trips every length', () => {
    for (let n = 0; n < 40; n++) {
      const b = new Uint8Array(n).map((_, i) => (i * 37 + n) & 255);
      expect([...fromB64(toB64(b))]).toEqual([...b]);
    }
  });
});

describe('share codes', () => {
  it('round-trips and tolerates extra text around it', () => {
    const c = { server: 'https://pb.example.com', id: 'abc123def456ghi', key: newKey() };
    expect(parseShareCode(`Follow me: ${makeShareCode(c)} thanks`)).toEqual(c);
    expect(() => parseShareCode('hello')).toThrow();
  });
});

describe('caregiver status', () => {
  setTimeRules({ ramadan: DEFAULT_SETTINGS.ramadan, timeChanges: [], travelMode: false, homeTimeZone: null });
  const meds = [med('a', 'Metformin', ['08:00', '20:00']), med('b', 'Atorvastatin', ['21:00'])];
  const logs = new Map<string, DoseLog>([
    [slotKey('a', '2026-11-19', '08:00'), { slot: slotKey('a', '2026-11-19', '08:00'), medId: 'a', date: '2026-11-19', time: '08:00', status: 'taken', at: '2026-11-19T04:10:00Z' }],
  ]);
  const now = new Date(2026, 10, 19, 20, 45);

  it('hides medicine names unless shared', () => {
    const hidden = buildStatus({ meds, logs, today: '2026-11-19', now, name: 'Mum', showNames: false });
    expect(JSON.stringify(hidden)).not.toMatch(/Metformin|Atorvastatin|10 mg/);
    expect(hidden.doses.filter((d) => d.date === '2026-11-19').map((d) => d.label)).toEqual(['Medicine A', 'Medicine A', 'Medicine B']);
    const shown = buildStatus({ meds, logs, today: '2026-11-19', now, name: 'Mum', showNames: true });
    expect(shown.doses.some((d) => d.label === 'Metformin')).toBe(true);
  });

  it('finds overdue doses and when to alert next', () => {
    const s = buildStatus({ meds, logs, today: '2026-11-19', now, name: 'Mum', showNames: false });
    const late = overdue(s, now, 30).filter((d) => d.date === '2026-11-19');
    expect(late.map((d) => new Date(d.due).getHours())).toEqual([20]);
    expect(nextAlerts(s, now, 30).map((a) => a.at.getHours() + ':' + a.at.getMinutes())).toEqual(['21:30']);
    expect(s.week).toHaveLength(7);
    expect(s.week[6]).toEqual({ date: '2026-11-19', done: 1, total: 3 });
  });
});

describe('pocketbase client', () => {
  const fake = (routes: Record<string, (init: RequestInit) => [number, unknown]>): Fetch =>
    (async (url: string, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${url}`;
      const handler = Object.entries(routes).find(([k]) => key.startsWith(k))?.[1];
      const [status, body] = handler ? handler(init) : [404, { message: 'nope' }];
      return new Response(JSON.stringify(body), { status });
    }) as Fetch;

  it('signs in, creates a vault, and falls back to create when the old one is gone', async () => {
    const f = fake({
      'POST https://pb.test/api/collections/users/auth-with-password': () => [200, { token: 't', record: { id: 'u1', email: 'a@b.c' } }],
      'PATCH https://pb.test/api/collections/vaults/records/old': () => [404, {}],
      'POST https://pb.test/api/collections/vaults/records': (init) => {
        const b = JSON.parse(String(init.body));
        expect(b).toMatchObject({ owner: 'u1', kind: 'share' });
        expect((init.headers as Record<string, string>).Authorization).toBe('t');
        return [200, { id: 'new1', kind: 'share', data: b.data, updated: '' }];
      },
      'GET https://pb.test/api/collections/vaults/records/new1': () => [200, { id: 'new1', kind: 'share', data: 'x', updated: 'u' }],
    });
    const s = await signIn(f, 'pb.test/', 'a@b.c', 'pw');
    expect(s.server).toBe('https://pb.test');
    expect(await putVault(f, s, 'share', 'sealed', 'old')).toBe('new1');
    expect(await getShared(f, 'pb.test', 'new1')).toEqual({ data: 'x', updated: 'u' });
  });

  it('turns a 401 into a sign-in message', async () => {
    const f = fake({ 'POST https://pb.test/api/collections/users/auth-with-password': () => [401, {}] });
    await expect(signIn(f, 'pb.test', 'a', 'b')).rejects.toThrow(/Sign in/);
  });
});

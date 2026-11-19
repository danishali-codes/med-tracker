import { describe, expect, it } from 'vitest';
import { groupFromReminderId, planReminders } from '../reminders';
import { slotKey } from '../schedule';
import { DEFAULT_SETTINGS, type DoseLog, type Medication } from '../types';

const med = (id: string, times: string[]): Medication => ({
  id,
  name: id,
  dose: '1',
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times, startDate: '2026-11-01' },
  stock: null,
  perDose: 1,
  refillAt: null,
  archived: false,
  createdAt: '2026-11-01T00:00:00Z',
});

const base = {
  snoozes: new Map<string, string>(),
  settings: { ...DEFAULT_SETTINGS, nagEnabled: false },
  horizonDays: 1,
  maxCount: 100,
};

describe('planReminders', () => {
  it('groups meds due at the same time into one reminder', () => {
    const plan = planReminders({ ...base, meds: [med('a', ['08:00']), med('b', ['08:00'])], logs: new Map(), now: new Date(2026, 10, 17, 7, 0) });
    expect(plan[0].id).toBe('dose:2026-11-17|08:00|0');
    expect(plan[0].medIds).toEqual(['a', 'b']);
  });

  it('leaves out doses already answered and times already passed', () => {
    const logs = new Map<string, DoseLog>([
      [slotKey('a', '2026-11-17', '20:00'), { slot: slotKey('a', '2026-11-17', '20:00'), medId: 'a', date: '2026-11-17', time: '20:00', status: 'taken', at: '' }],
    ]);
    const plan = planReminders({ ...base, meds: [med('a', ['08:00', '20:00'])], logs, now: new Date(2026, 10, 17, 9, 0) });
    expect(plan.map((p) => `${p.date} ${p.time}`)).toEqual(['2026-11-18 08:00', '2026-11-18 20:00']);
  });

  it('nags every N minutes until answered, including after the due time has passed', () => {
    const settings = { ...DEFAULT_SETTINGS, nagEnabled: true, nagEveryMinutes: 15, nagCount: 3 };
    const plan = planReminders({ ...base, settings, horizonDays: 0, meds: [med('a', ['08:00'])], logs: new Map(), now: new Date(2026, 10, 17, 8, 20) });
    expect(plan.map((p) => p.at.getMinutes())).toEqual([30, 45]);
    expect(plan.every((p) => p.kind === 'nag')).toBe(true);
  });

  it('restarts from the snooze time', () => {
    const snoozes = new Map([['2026-11-17|08:00', new Date(2026, 10, 17, 8, 10).toISOString()]]);
    const plan = planReminders({ ...base, snoozes, horizonDays: 0, meds: [med('a', ['08:00'])], logs: new Map(), now: new Date(2026, 10, 17, 8, 1) });
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('snoozed');
    expect(plan[0].at.getMinutes()).toBe(10);
  });

  it('respects the cap', () => {
    const plan = planReminders({ ...base, horizonDays: 30, maxCount: 5, meds: [med('a', ['08:00'])], logs: new Map(), now: new Date(2026, 10, 17, 7, 0) });
    expect(plan).toHaveLength(5);
  });

  it('parses the group back out of an id', () => {
    expect(groupFromReminderId('dose:2026-11-17|08:00|2')).toBe('2026-11-17|08:00');
    expect(groupFromReminderId('other')).toBeNull();
  });
});

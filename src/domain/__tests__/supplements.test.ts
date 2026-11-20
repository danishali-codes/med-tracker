import { describe, expect, it } from 'vitest';
import { computeProgress, summarizeDay } from '../progress';
import { planReminders, reminderText } from '../reminders';
import { slotKey } from '../schedule';
import { DEFAULT_SETTINGS, type DoseLog, type Medication } from '../types';

const med = (id: string, times: string[], supplement = false): Medication => ({
  id,
  name: id,
  strength: '1 mg',
  amount: 1,
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times, startDate: '2026-11-01' },
  stock: null,
  refillAt: null,
  archived: false,
  supplement,
  createdAt: '2026-11-01T00:00:00Z',
});

const taken = (id: string, date: string, time: string): [string, DoseLog] => {
  const slot = slotKey(id, date, time);
  return [slot, { slot, medId: id, date, time, status: 'taken', at: new Date(`${date}T${time}:00`).toISOString() }];
};

describe('supplements', () => {
  const meds = [med('metformin', ['08:00']), med('vitamin-d', ['08:00'], true)];

  it('never count towards the day, so a missed supplement keeps the day complete', () => {
    const logs = new Map([taken('metformin', '2026-11-10', '08:00')]);
    const s = summarizeDay(meds, logs, '2026-11-10', '2026-11-12', 60);
    expect(s.scheduled).toBe(1);
    expect(s.status).toBe('complete');
  });

  it('a whole run of missed supplements leaves the streak alone', () => {
    const days = ['2026-11-10', '2026-11-11', '2026-11-12'];
    const logs = new Map(days.map((d) => taken('metformin', d, '08:00')));
    const summaries = days.map((d) => summarizeDay(meds, logs, d, '2026-11-12', 60));
    expect(computeProgress(summaries).currentStreak).toBe(3);
  });

  it('a day with only supplements due is neutral', () => {
    const s = summarizeDay([med('fish-oil', ['09:00'], true)], new Map(), '2026-11-10', '2026-11-12', 60);
    expect(s.status).toBe('none');
  });

  it('get one reminder and no repeats when nothing else is due then', () => {
    const settings = { ...DEFAULT_SETTINGS, missedNotice: false, nagEnabled: true, nagEveryMinutes: 15, nagCount: 3 };
    const plan = planReminders({
      meds: [med('vitamin-d', ['09:00'], true)],
      logs: new Map(),
      snoozes: new Map(),
      settings,
      horizonDays: 0,
      maxCount: 100,
      now: new Date(2026, 10, 17, 7, 0),
    });
    expect(plan.map((p) => p.kind)).toEqual(['due']);
  });

  it('still repeat when a medicine shares the time', () => {
    const settings = { ...DEFAULT_SETTINGS, missedNotice: false, nagEnabled: true, nagEveryMinutes: 15, nagCount: 2 };
    const plan = planReminders({ meds, logs: new Map(), snoozes: new Map(), settings, horizonDays: 0, maxCount: 100, now: new Date(2026, 10, 17, 7, 0) });
    expect(plan.map((p) => p.kind)).toEqual(['due', 'nag', 'nag']);
  });

  it('are named as supplements in reminders, without saying which', () => {
    expect(reminderText({ kind: 'due', time: '09:00' }, [med('vitamin-d', ['09:00'], true)], false).title).toBe('Time for your 9:00 AM supplement');
    expect(reminderText({ kind: 'due', time: '08:00' }, meds, false).body).toBe('1 medicine and 1 supplement to take');
    const missed = reminderText({ kind: 'missed', time: '22:00' }, meds, false);
    expect(missed.title).toBe('2 doses not logged today');
    expect(missed.body).not.toContain('metformin');
  });
});

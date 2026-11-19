import { describe, expect, it } from 'vitest';
import { medDays, summarizeDay } from '../progress';
import { dosesOn, indexLogs, isPausedOn, pauseMed, resumeMed, slotKey } from '../schedule';
import type { DoseLog, Medication } from '../types';

const med: Medication = {
  id: 'm',
  name: 'Med',
  strength: '',
  amount: 1,
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times: ['08:00'], startDate: '2026-11-01' },
  stock: null,
  refillAt: null,
  archived: false,
  createdAt: '2026-11-01T00:00:00Z',
};

const taken = (date: string): DoseLog => ({ slot: slotKey('m', date, '08:00'), medId: 'm', date, time: '08:00', status: 'taken', at: `${date}T08:00:00` });

describe('pausing a med', () => {
  it('has no doses while paused and comes back on resume', () => {
    const paused = pauseMed(med, '2026-11-10');
    expect(dosesOn([paused], '2026-11-09')).toHaveLength(1);
    expect(dosesOn([paused], '2026-11-12')).toHaveLength(0);
    const resumed = resumeMed(paused, '2026-11-15');
    expect(isPausedOn(resumed, '2026-11-14')).toBe(true);
    expect(dosesOn([resumed], '2026-11-15')).toHaveLength(1);
  });

  it('resuming on the day it was paused removes the pause', () => {
    expect(resumeMed(pauseMed(med, '2026-11-10'), '2026-11-10').pauses).toEqual([]);
  });

  it('paused days are neutral for the streak', () => {
    const s = summarizeDay([pauseMed(med, '2026-11-10')], new Map(), '2026-11-11', '2026-11-20', 60);
    expect(s.status).toBe('none');
  });
});

describe('seven-day marks', () => {
  it('marks taken, missed, pending and off days', () => {
    const logs = indexLogs([taken('2026-11-13'), taken('2026-11-15')]);
    const m = { ...med, schedule: { ...med.schedule, pattern: { kind: 'weekdays' as const, days: [0, 2, 3, 4, 5, 6] } } };
    const marks = medDays(m, logs, '2026-11-16').map((d) => d.mark);
    // 10 Tue missed, 11 Wed missed, 12 Thu missed, 13 Fri taken, 14 Sat missed, 15 Sun taken, 16 Mon off (not a chosen day)
    expect(marks).toEqual(['missed', 'missed', 'missed', 'taken', 'missed', 'taken', 'off']);
    expect(medDays(med, logs, '2026-11-16').at(-1)?.mark).toBe('pending');
  });
});

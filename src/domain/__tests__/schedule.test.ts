import { describe, expect, it } from 'vitest';
import { addDays, diffDays, weekdayOf } from '../dates';
import { describeSchedule, dosesOn, isDueOn, nextDueDate, punctuality } from '../schedule';
import type { Medication, Schedule, SchedulePattern } from '../types';

const sched = (pattern: SchedulePattern, extra: Partial<Schedule> = {}): Schedule => ({
  pattern,
  times: ['08:00'],
  startDate: '2026-11-02', // a Monday
  ...extra,
});

const dueDays = (s: Schedule, from: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(from, i)).filter((d) => isDueOn(s, d));

describe('dates', () => {
  it('handles month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-11-02', '2026-11-16')).toBe(14);
    expect(weekdayOf('2026-11-02')).toBe(1);
  });
});

describe('isDueOn', () => {
  it('daily from the start date only', () => {
    const s = sched({ kind: 'daily' });
    expect(isDueOn(s, '2026-11-01')).toBe(false);
    expect(isDueOn(s, '2026-11-02')).toBe(true);
    expect(isDueOn(s, '2027-03-15')).toBe(true);
  });

  it('respects the end date', () => {
    const s = sched({ kind: 'daily' }, { endDate: '2026-11-05' });
    expect(isDueOn(s, '2026-11-05')).toBe(true);
    expect(isDueOn(s, '2026-11-06')).toBe(false);
  });

  it('specific weekdays', () => {
    const s = sched({ kind: 'weekdays', days: [1, 4] }); // Mon, Thu
    expect(dueDays(s, '2026-11-02', 14)).toEqual(['2026-11-02', '2026-11-05', '2026-11-09', '2026-11-12']);
  });

  it('weekly and every two weeks', () => {
    const weekly = sched({ kind: 'interval', every: 1, unit: 'week' });
    expect(dueDays(weekly, '2026-11-01', 22)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    const fortnightly = sched({ kind: 'interval', every: 2, unit: 'week' });
    expect(dueDays(fortnightly, '2026-11-01', 45)).toEqual(['2026-11-02', '2026-11-16', '2026-11-30', '2026-12-14']);
  });

  it('every N days', () => {
    const s = sched({ kind: 'interval', every: 3, unit: 'day' });
    expect(dueDays(s, '2026-11-02', 10)).toEqual(['2026-11-02', '2026-11-05', '2026-11-08', '2026-11-11']);
  });

  it('cycles such as 21 on / 7 off', () => {
    const s = sched({ kind: 'cycle', onDays: 21, offDays: 7 });
    const due = dueDays(s, '2026-11-02', 56);
    expect(due.length).toBe(42);
    expect(isDueOn(s, addDays('2026-11-02', 20))).toBe(true);
    expect(isDueOn(s, addDays('2026-11-02', 21))).toBe(false);
    expect(isDueOn(s, addDays('2026-11-02', 28))).toBe(true);
  });

  it('monthly clamps to the last day of short months', () => {
    const s = sched({ kind: 'monthly', dayOfMonth: 31 }, { startDate: '2026-01-01' });
    expect(isDueOn(s, '2026-02-28')).toBe(true);
    expect(isDueOn(s, '2026-04-30')).toBe(true);
    expect(isDueOn(s, '2026-05-31')).toBe(true);
    expect(isDueOn(s, '2026-05-30')).toBe(false);
  });

  it('as-needed is never scheduled', () => {
    expect(isDueOn(sched({ kind: 'asNeeded' }), '2026-11-02')).toBe(false);
  });

  it('nextDueDate finds the next fortnightly dose', () => {
    const s = sched({ kind: 'interval', every: 2, unit: 'week' });
    expect(nextDueDate(s, '2026-11-03')).toBe('2026-11-16');
  });
});

describe('dosesOn', () => {
  it('lists one dose per time and skips archived meds', () => {
    const meds = [
      { id: 'a', archived: false, schedule: sched({ kind: 'daily' }, { times: ['20:00', '08:00'] }) },
      { id: 'b', archived: true, schedule: sched({ kind: 'daily' }) },
    ] as Medication[];
    const doses = dosesOn(meds, '2026-11-03');
    expect(doses.map((d) => d.time)).toEqual(['08:00', '20:00']);
    expect(doses[0].slot).toBe('a|2026-11-03|08:00');
  });
});

describe('punctuality', () => {
  it('is on time within the window and late after it', () => {
    const dose = { date: '2026-11-03', time: '08:00' };
    expect(punctuality(dose, new Date(2026, 10, 3, 8, 45), 60)).toBe('onTime');
    expect(punctuality(dose, new Date(2026, 10, 3, 19, 0), 60)).toBe('late');
  });
});

describe('describeSchedule', () => {
  it('reads naturally', () => {
    expect(describeSchedule(sched({ kind: 'interval', every: 2, unit: 'week' }))).toBe('Every 2 weeks · 8:00 AM');
    expect(describeSchedule(sched({ kind: 'interval', every: 1, unit: 'week' }))).toBe('Weekly (Mon) · 8:00 AM');
    expect(describeSchedule(sched({ kind: 'asNeeded' }, { times: [] }))).toBe('As needed');
  });
});

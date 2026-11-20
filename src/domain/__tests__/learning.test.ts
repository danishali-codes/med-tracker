import { describe, expect, it } from 'vitest';
import { addDays, weekdayOf } from '../dates';
import { addDayTime, suggestDayTimes, suggestRoutines } from '../insights';
import { slotKey } from '../schedule';
import type { DoseLog, Medication } from '../types';

const med = (id: string, times: string[]): Medication => ({
  id,
  name: id,
  strength: '',
  amount: 1,
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times, startDate: '2026-09-01' },
  stock: null,
  refillAt: null,
  archived: false,
  createdAt: '2026-09-01T00:00:00Z',
});

const log = (medId: string, date: string, time: string, takenAt: string): DoseLog => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = takenAt.split(':').map(Number);
  return { slot: slotKey(medId, date, time), medId, date, time, status: 'taken', at: new Date(y, m - 1, d, h, min).toISOString() };
};

const TODAY = '2026-11-20';
const lastDays = (n: number) => Array.from({ length: n }, (_, i) => addDays(TODAY, -(i + 1)));

describe('learning weekday times', () => {
  it('spots weekends taken much later and suggests a weekend time', () => {
    const logs = lastDays(42).map((d) => log('a', d, '08:00', [0, 6].includes(weekdayOf(d)) ? '09:40' : '08:05'));
    const [s] = suggestDayTimes([med('a', ['08:00'])], logs, TODAY);
    expect(s.days).toEqual([0, 6]);
    expect(s.suggested).toBe('09:40');
    expect(s.medIds).toEqual(['a']);
  });

  it('stays quiet when every day is about the same', () => {
    const logs = lastDays(42).map((d) => log('a', d, '08:00', '08:20'));
    expect(suggestDayTimes([med('a', ['08:00'])], logs, TODAY)).toEqual([]);
  });

  it('adds the change as different times on those days', () => {
    const m = addDayTime(med('a', ['08:00', '20:00']), '08:00', [6, 0], '09:30')!;
    expect(m.schedule.times).toEqual(['08:00', '20:00']);
    expect(m.schedule.dayTimes).toEqual([{ days: [0, 6], times: ['09:30', '20:00'] }]);
    expect(addDayTime(m, '20:00', [6], '21:00')).toBeNull(); // Saturday already has its own times
  });
});

describe('learning routines', () => {
  it('suggests one routine for two times taken together', () => {
    const logs = lastDays(14).flatMap((d) => [log('a', d, '08:00', '08:25'), log('b', d, '09:00', '08:27')]);
    const [s] = suggestRoutines([med('a', ['08:00']), med('b', ['09:00'])], logs, TODAY);
    expect(s.times).toEqual(['08:00', '09:00']);
    expect(s.suggested).toBe('08:25');
    expect(s.name).toBe('Morning');
    expect(s.medIds).toEqual(['a', 'b']);
  });

  it("ignores logs from medicines that aren't due at those times any more", () => {
    const logs = lastDays(14).flatMap((d) => [log('old1', d, '08:00', '08:10'), log('old2', d, '09:00', '08:10')]);
    expect(suggestRoutines([med('a', ['08:00']), med('b', ['09:00'])], logs, TODAY)).toEqual([]);
  });

  it('leaves times alone that are taken apart', () => {
    const logs = lastDays(14).flatMap((d) => [log('a', d, '08:00', '08:05'), log('b', d, '09:00', '09:05')]);
    expect(suggestRoutines([med('a', ['08:00']), med('b', ['09:00'])], logs, TODAY)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import { findHealthPatterns, formatSleep, formatSteps, healthTable, type HealthDay } from '../health';
import type { DaySummary } from '../progress';
import type { DayNote } from '../types';

const start = '2026-10-01';
const day = (i: number, status: DaySummary['status']): DaySummary => ({
  date: addDays(start, i),
  scheduled: 2,
  taken: status === 'complete' ? 2 : 1,
  onTime: status === 'complete' ? 2 : 1,
  late: 0,
  skipped: 0,
  status,
});

// Even days: everything taken. Odd days: a dose missed.
const N = 12;
const summaries = Array.from({ length: N }, (_, i) => day(i, i % 2 === 0 ? 'complete' : 'partial'));

describe('findHealthPatterns', () => {
  it('finds shorter sleep before days with a missed dose', () => {
    const health: HealthDay[] = summaries.map((s, i) => ({ date: s.date, sleepMin: i % 2 === 0 ? 450 : 360 }));
    const p = findHealthPatterns({ summaries, notes: [], health });
    const sleep = p.find((x) => x.id === 'health-sleep-missed');
    expect(sleep?.title).toBe('You miss doses more after a short night');
    expect(sleep?.detail).toContain('6h');
    expect(sleep?.detail).toContain('7h 30m');
    expect(sleep?.detail).toContain('1 hour 30 minutes less');
  });

  it('stays quiet when the difference is small or there are too few days', () => {
    const small: HealthDay[] = summaries.map((s, i) => ({ date: s.date, sleepMin: i % 2 === 0 ? 430 : 420, steps: i % 2 ? 6000 : 6300 }));
    expect(findHealthPatterns({ summaries, notes: [], health: small })).toEqual([]);
    const few: HealthDay[] = summaries.slice(0, 4).map((s, i) => ({ date: s.date, sleepMin: i % 2 === 0 ? 480 : 300 }));
    expect(findHealthPatterns({ summaries, notes: [], health: few })).toEqual([]);
  });

  it('notices busy days and resting heart rate', () => {
    const health: HealthDay[] = summaries.map((s, i) => ({ date: s.date, steps: i % 2 ? 14000 : 6000, restingHr: i % 2 ? 72 : 64 }));
    const ids = findHealthPatterns({ summaries, notes: [], health }).map((x) => x.id);
    expect(ids).toContain('health-steps-missed');
    expect(ids).toContain('health-resting-missed');
    const steps = findHealthPatterns({ summaries, notes: [], health }).find((x) => x.id === 'health-steps-missed');
    expect(steps?.title).toBe('Doses get missed more on busy days');
  });

  it('lines up mood with sleep and steps', () => {
    const health: HealthDay[] = summaries.map((s, i) => ({ date: s.date, sleepMin: i % 2 ? 330 : 480, steps: i % 2 ? 2000 : 9000 }));
    const notes: DayNote[] = summaries.map((s, i) => ({ date: s.date, mood: i % 2 ? 2 : 4, symptoms: [], text: '' }));
    const ids = findHealthPatterns({ summaries: [], notes, health }).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['health-sleep-mood', 'health-steps-mood']));
  });

  it('ignores days with nothing due and nights under an hour', () => {
    const empty = summaries.map((s) => ({ ...s, scheduled: 0, status: 'none' as const }));
    const health: HealthDay[] = summaries.map((s, i) => ({ date: s.date, sleepMin: i % 2 ? 30 : 480 }));
    expect(findHealthPatterns({ summaries: empty, notes: [], health })).toEqual([]);
    expect(findHealthPatterns({ summaries, notes: [], health })).toEqual([]);
  });
});

describe('formatting', () => {
  it('formats sleep and steps', () => {
    expect(formatSleep(undefined)).toBe('-');
    expect(formatSleep(45)).toBe('45m');
    expect(formatSleep(420)).toBe('7h');
    expect(formatSleep(455)).toBe('7h 35m');
    expect(formatSteps(undefined)).toBe('-');
    expect(formatSteps(8421)).toBe('8,421');
    expect(formatSteps(12345)).toBe('12.3k');
  });
});

describe('healthTable', () => {
  it('lists days newest first with doses, mood and health side by side', () => {
    const rows = healthTable({
      today: addDays(start, 2),
      days: 3,
      health: [{ date: addDays(start, 1), steps: 5000 }],
      summaries,
      notes: [{ date: addDays(start, 2), mood: 5, symptoms: [], text: '' }],
    });
    expect(rows.map((r) => r.date)).toEqual([addDays(start, 2), addDays(start, 1), start]);
    expect(rows[0].mood).toBe(5);
    expect(rows[1].health?.steps).toBe(5000);
    expect(rows[2].summary?.status).toBe('complete');
  });
});

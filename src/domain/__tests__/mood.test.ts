import { describe, expect, it } from 'vitest';
import { moodTrend } from '../insights';
import type { DayNote } from '../types';

const note = (date: string, mood: DayNote['mood'], symptoms: string[] = []): DayNote => ({ date, mood, symptoms, text: '' });

describe('moodTrend', () => {
  const notes = [
    note('2026-10-28', 2),
    note('2026-11-01', 3, ['Headache']), // Sunday
    note('2026-11-02', 4),
    note('2026-11-08', 5, ['Headache', 'Tired']), // Sunday
    note('2026-11-09', null, ['Tired']),
  ];
  const t = moodTrend(notes, '2026-11-01', '2026-11-10');

  it('averages the period and the one before it', () => {
    expect(t.points.map((p) => p.mood)).toEqual([3, 4, 5]);
    expect(t.average).toBe(4);
    expect(t.previousAverage).toBe(2);
    expect(t.noted).toBe(4);
  });

  it('keeps a 7-day running average for the line', () => {
    expect(t.rolling).toHaveLength(10);
    expect(t.rolling[0]).toEqual({ date: '2026-11-01', avg: 2.5 }); // 1 Nov and 28 Oct
    expect(t.rolling[7].avg).toBe(4.5); // 8 Nov and 2 Nov
  });

  it('finds weekdays and symptoms', () => {
    expect(t.byWeekday[0]).toBe(4); // two Sundays: 3 and 5
    expect(t.byWeekday[1]).toBeNull(); // one Monday is not enough
    expect(t.counts).toEqual([0, 0, 1, 1, 1]);
    expect(t.topSymptoms).toEqual([
      { name: 'Headache', days: 2 },
      { name: 'Tired', days: 2 },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { addDays, eachDay } from '../dates';
import { buildReview, findPatterns, moveTime, suggestTimings } from '../insights';
import { computeProgress, consistency, isGoldDay, newMilestone, summarizeDay, type DaySummary } from '../progress';
import { reminderText } from '../reminders';
import { applyRoutine, eatAfter } from '../routines';
import { indexLogs, slotKey } from '../schedule';
import type { DayNote, DoseLog, Medication } from '../types';

const med = (id: string, times = ['08:00'], extra: Partial<Medication> = {}): Medication => ({
  id,
  name: id,
  strength: '1 mg',
  amount: 1,
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times, startDate: '2026-09-01' },
  stock: null,
  refillAt: null,
  archived: false,
  createdAt: '2026-09-01T00:00:00Z',
  ...extra,
});

const local = (date: string, hh: number, mm = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};
const log = (medId: string, date: string, time: string, status: DoseLog['status'], at: Date): DoseLog => ({
  slot: slotKey(medId, date, time),
  medId,
  date,
  time,
  status,
  at: at.toISOString(),
});

let n = 0;
const day = (status: DaySummary['status'], extra: Partial<DaySummary> = {}): DaySummary => ({
  date: addDays('2026-10-01', n++),
  scheduled: 1,
  taken: status === 'complete' ? 1 : 0,
  onTime: status === 'complete' ? 1 : 0,
  late: 0,
  skipped: 0,
  status,
  ...extra,
});
const run = (spec: string) => {
  n = 0;
  return [...spec].map((ch) => day(ch === 'c' ? 'complete' : ch === 'm' ? 'missed' : 'none'));
};

describe('planned skips', () => {
  it('a day with every dose skipped on purpose is neutral', () => {
    const meds = [med('a')];
    const logs = indexLogs([log('a', '2026-11-03', '08:00', 'skipped', local('2026-11-02', 20))]);
    expect(summarizeDay(meds, logs, '2026-11-03', '2026-11-10', 60).status).toBe('none');
  });

  it("doesn't use a freeze or break the streak", () => {
    const p = computeProgress(run('ccccccc' + 'n' + 'cc'));
    expect(p.currentStreak).toBe(9);
    expect(p.freezes).toBe(1);
    expect(p.frozenDays.size).toBe(0);
  });
});

describe('earn the streak back', () => {
  it('3 complete days after a miss bring the old streak back', () => {
    const p = computeProgress(run('cccccc' + 'm' + 'ccc'));
    // 6 days (no freeze yet: the first comes at 7), missed, then 3 more = 9
    expect(p.currentStreak).toBe(9);
    expect(p.earnedBack).toBe(1);
    expect(p.restoredDays.size).toBe(1);
    expect(p.earnBack).toBeNull();
  });

  it('shows the days left while it can still be won back', () => {
    const p = computeProgress(run('ccccc' + 'm' + 'c'));
    expect(p.currentStreak).toBe(1);
    expect(p.earnBack).toEqual({ streak: 5, missedOn: '2026-10-06', daysLeft: 2 });
  });

  it('a second miss loses it', () => {
    const p = computeProgress(run('ccccc' + 'm' + 'c' + 'm' + 'ccc'));
    expect(p.currentStreak).toBe(3);
    expect(p.earnedBack).toBe(0);
  });

  it('short streaks are not worth winning back', () => {
    expect(computeProgress(run('cc' + 'm' + 'c')).earnBack).toBeNull();
  });

  it('a freeze is used first', () => {
    const p = computeProgress(run('ccccccc' + 'm' + 'c'));
    expect(p.currentStreak).toBe(8);
    expect(p.frozenDays.size).toBe(1);
    expect(p.earnBack).toBeNull();
  });
});

describe('perfect streak and gold days', () => {
  it('a freeze resets the perfect streak but not the streak', () => {
    const p = computeProgress(run('ccccccc' + 'm' + 'cc'));
    expect(p.currentStreak).toBe(9);
    expect(p.perfectStreak).toBe(2);
    expect(p.bestPerfectStreak).toBe(7);
  });

  it('gold days need every dose on time', () => {
    expect(isGoldDay(day('complete'))).toBe(true);
    expect(isGoldDay(day('complete', { onTime: 0, late: 1 }))).toBe(false);
    expect(isGoldDay(day('none'))).toBe(false);
  });

  it('milestones', () => {
    expect(newMilestone(7, 0)).toBe(7);
    expect(newMilestone(8, 7)).toBeNull();
    expect(newMilestone(31, 7)).toBe(30);
  });
});

describe('consistency score', () => {
  it('climbs with good days and only dents on one bad day', () => {
    const good = run('c'.repeat(60));
    const high = consistency(good);
    expect(high).toBeGreaterThan(0.9);
    const dented = consistency([...good, day('missed')]);
    expect(dented).toBeGreaterThan(0.85);
    expect(dented).toBeLessThan(high);
  });

  it('ignores days with nothing due', () => {
    expect(consistency(run('cccnnnnn'))).toBeCloseTo(consistency(run('ccc')), 6);
  });
});

describe('smart timing', () => {
  const today = '2026-11-19';
  const m = med('a', ['08:00']);
  const takenAt = (mins: number) =>
    eachDay(addDays(today, -14), addDays(today, -1)).map((d) => log('a', d, '08:00', 'taken', local(d, 8, mins)));

  it('suggests moving a reminder you always answer 40 minutes late', () => {
    const s = suggestTimings([m], takenAt(40), today);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ time: '08:00', suggested: '08:40', typicalOffset: 40 });
  });

  it('leaves it alone when you take it on time', () => {
    expect(suggestTimings([m], takenAt(5), today)).toHaveLength(0);
  });

  it('needs a week of samples', () => {
    expect(suggestTimings([m], takenAt(40).slice(-5), today)).toHaveLength(0);
  });

  it('moveTime keeps weekday times lined up with their doses', () => {
    const w = med('w', ['08:00', '20:00']);
    w.schedule.dayTimes = [{ days: [1], times: ['09:00', '21:00'] }];
    // 08:00 moves past 20:00, so the order flips; Monday's overrides must follow their doses.
    const moved = moveTime(w, '08:00', '22:00')!;
    expect(moved.schedule.times).toEqual(['20:00', '22:00']);
    expect(moved.schedule.dayTimes![0].times).toEqual(['21:00', '09:00']);
  });

  it("never merges two doses into one", () => {
    expect(moveTime(med('x', ['08:00', '09:00']), '08:00', '09:00')).toBeNull();
    const both = med('a', ['08:00', '09:00']);
    const logs = eachDay(addDays(today, -14), addDays(today, -1)).map((d) => log('a', d, '08:00', 'taken', local(d, 9, 0)));
    expect(suggestTimings([both], logs, today)).toHaveLength(0);
  });
});

describe('routines', () => {
  const a = med('a', ['08:00', '20:00']);
  const b = med('b', ['09:00']);
  const c = med('c', ['08:00']);

  it('adds the time to members and leaves others alone', () => {
    const out = applyRoutine([a, b, c], { id: 'r', name: 'Breakfast', time: '08:00' }, null, new Set(['a', 'b', 'c']));
    expect(out.map((m) => [m.id, m.schedule.times])).toEqual([['b', ['08:00', '09:00']]]);
  });

  it('moving a routine moves its members', () => {
    const out = applyRoutine([a, b, c], { id: 'r', name: 'Breakfast', time: '07:30' }, { id: 'r', name: 'Breakfast', time: '08:00' }, new Set(['a', 'c']));
    expect(out.map((m) => [m.id, m.schedule.times])).toEqual([
      ['a', ['07:30', '20:00']],
      ['c', ['07:30']],
    ]);
  });

  it('taking a medicine out of a routine keeps its weekday times on the right dose', () => {
    const w = med('w', ['08:00', '20:00']);
    w.schedule.dayTimes = [{ days: [1], times: ['09:00', '21:00'] }];
    const [out] = applyRoutine([w], { id: 'r', name: 'Breakfast', time: '08:00' }, { id: 'r', name: 'Breakfast', time: '08:00' }, new Set());
    expect(out.schedule.times).toEqual(['20:00']);
    expect(out.schedule.dayTimes![0].times).toEqual(['21:00']);
  });

  it('adding a medicine to a routine keeps its existing weekday times', () => {
    const w = med('w', ['20:00']);
    w.schedule.dayTimes = [{ days: [1], times: ['21:00'] }];
    const [out] = applyRoutine([w], { id: 'r', name: 'Breakfast', time: '08:00' }, null, new Set(['w']));
    expect(out.schedule.times).toEqual(['08:00', '20:00']);
    expect(out.schedule.dayTimes![0].times).toEqual(['08:00', '21:00']);
  });

  it('names the routine in the reminder', () => {
    expect(reminderText({ kind: 'due', time: '08:00' }, [a, c], false, 'Breakfast').title).toBe('Breakfast: time for your 8:00 AM dose');
    expect(reminderText({ kind: 'nag', time: '08:00' }, [a], false, 'Breakfast').title).toBe('Still waiting: Breakfast');
  });

  it('food timer waits for the longest empty-stomach medicine', () => {
    const at = new Date(2026, 10, 19, 7, 0);
    const until = eatAfter([{ food: 'empty', foodWaitMinutes: 30 }, { food: 'empty', foodWaitMinutes: 60 }, { food: 'with' }], at);
    expect(until?.getHours()).toBe(8);
    expect(eatAfter([{ food: 'with' }], at)).toBeNull();
  });
});

describe('review and patterns', () => {
  it('sums up a month', () => {
    n = 0;
    const days: DaySummary[] = eachDay('2026-10-01', '2026-10-31').map((date, i) => ({
      date,
      scheduled: 2,
      taken: i % 10 === 0 ? 1 : 2,
      onTime: i % 10 === 0 ? 1 : 2,
      late: 0,
      skipped: 0,
      status: i % 10 === 0 ? 'partial' : 'complete',
    }));
    const r = buildReview({ kind: 'month', y: 2026, m: 10, summaries: days, frozenDays: new Set(), notes: [], logs: new Map(), dueDoses: [], today: '2026-11-19' });
    expect(r.scheduled).toBe(62);
    expect(r.taken).toBe(58);
    expect(r.missedDays).toBe(4);
    expect(r.longestRun).toBe(9);
    expect(r.parts).toHaveLength(5);
  });

  it('finds a mood pattern only with enough days on both sides', () => {
    const dates = eachDay('2026-10-01', '2026-10-20');
    const summaries: DaySummary[] = dates.map((date, i) => ({ date, scheduled: 1, taken: i % 2 ? 0 : 1, onTime: i % 2 ? 0 : 1, late: 0, skipped: 0, status: i % 2 ? 'missed' : 'complete' }));
    const notes: DayNote[] = dates.map((date, i) => ({ date, mood: i % 2 ? 2 : 4, symptoms: [], text: '' }));
    const p = findPatterns({ summaries, notes, meds: [], logs: new Map() });
    expect(p[0].title).toMatch(/better on days you take every dose/);
    expect(findPatterns({ summaries: summaries.slice(0, 4), notes: notes.slice(0, 4), meds: [], logs: new Map() })).toHaveLength(0);
  });
});

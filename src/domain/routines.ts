import type { TimeOfDay } from './dates';
import type { FoodRule, Medication, Routine, Schedule } from './types';

export type TimeEdit = { add: TimeOfDay } | { remove: TimeOfDay } | { move: TimeOfDay; to: TimeOfDay };

/**
 * Changes a schedule's usual times while keeping weekday-specific times lined up. Those
 * rules match the usual times dose by dose (by position), so each dose carries its own
 * overrides through removals, additions, moves and the re-sort. A move onto a time the
 * medicine already has is refused (null), so two doses are never merged into one.
 */
export function editTimes(s: Schedule, edits: TimeEdit[]): Schedule | null {
  const rules = s.dayTimes ?? [];
  let entries = s.times.map((t, i) => ({ t, over: rules.map((r) => r.times[i] as TimeOfDay | undefined) }));
  for (const e of edits) {
    if ('add' in e) {
      if (!entries.some((x) => x.t === e.add)) entries.push({ t: e.add, over: rules.map(() => undefined) });
    } else if ('remove' in e) {
      entries = entries.filter((x) => x.t !== e.remove);
    } else {
      if (e.move === e.to) continue;
      if (entries.some((x) => x.t === e.to)) return null;
      entries = entries.map((x) => (x.t === e.move ? { ...x, t: e.to } : x));
    }
  }
  entries.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  return {
    ...s,
    times: entries.map((x) => x.t),
    dayTimes: s.dayTimes ? rules.map((r, k) => ({ ...r, times: entries.map((x) => x.over[k] ?? x.t) })) : s.dayTimes,
  };
}

/** The routine set for this reminder time, if any. */
export function routineAt(time: TimeOfDay, routines: Routine[] | undefined): Routine | undefined {
  return routines?.find((r) => r.time === time);
}

/** Medicines whose usual times include the routine's time. */
export function routineMembers(routine: Pick<Routine, 'time'>, meds: Medication[]): Medication[] {
  return meds.filter((m) => !m.archived && m.schedule.pattern.kind !== 'asNeeded' && m.schedule.times.includes(routine.time));
}

/**
 * Saves a routine's medicines and time onto the medicines themselves: members get the
 * routine's time (replacing its old time when the routine moved), and medicines taken out
 * lose it. Returns only the medicines that changed. A medicine is never left without a time.
 */
export function applyRoutine(meds: Medication[], routine: Routine, previous: Routine | null, memberIds: Set<string>): Medication[] {
  const out: Medication[] = [];
  for (const m of meds) {
    if (m.archived || m.schedule.pattern.kind === 'asNeeded') continue;
    const times = m.schedule.times;
    const wasIn = !!previous && times.includes(previous.time);
    const isIn = memberIds.has(m.id);
    let edits: TimeEdit[] = [];
    if (isIn && wasIn && previous!.time !== routine.time) {
      // Moving the routine moves this dose, unless the medicine already has a dose then.
      edits = times.includes(routine.time) ? [{ remove: previous!.time }] : [{ move: previous!.time, to: routine.time }];
    } else if (isIn && !wasIn) edits = [{ add: routine.time }];
    else if (!isIn && wasIn) edits = [{ remove: previous!.time }];
    if (edits.length === 0) continue;
    const schedule = editTimes(m.schedule, edits);
    if (!schedule || schedule.times.length === 0) continue;
    if (schedule.times.join() === times.join() && JSON.stringify(schedule.dayTimes) === JSON.stringify(m.schedule.dayTimes)) continue;
    out.push({ ...m, schedule });
  }
  return out;
}

export function foodLabel(rule: FoodRule | null | undefined, wait?: number | null): string | null {
  switch (rule) {
    case 'empty':
      return wait ? `Empty stomach, eat after ${wait} min` : 'Empty stomach';
    case 'with':
      return 'With food';
    case 'after':
      return 'After food';
    default:
      return null;
  }
}

/** When the person can eat after taking these medicines at `at`, or null when there's no wait. */
export function eatAfter(meds: Pick<Medication, 'food' | 'foodWaitMinutes'>[], at: Date): Date | null {
  const wait = Math.max(0, ...meds.map((m) => (m.food === 'empty' ? (m.foodWaitMinutes ?? 0) : 0)));
  return wait > 0 ? new Date(at.getTime() + wait * 60_000) : null;
}

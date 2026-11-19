import type { TimeOfDay } from './dates';
import type { FoodRule, Medication, Routine } from './types';

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
    const wasIn = previous ? times.includes(previous.time) : false;
    const isIn = memberIds.has(m.id);
    let next = times;
    if (isIn) next = [...times.filter((t) => !(wasIn && previous && t === previous.time)), routine.time];
    else if (wasIn && previous) next = times.filter((t) => t !== previous.time);
    next = [...new Set(next)].sort();
    if (next.length === 0) continue;
    if (next.join() === times.join()) continue;
    out.push({ ...m, schedule: { ...m.schedule, times: next } });
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

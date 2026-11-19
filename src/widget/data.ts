import { atTime, formatTime, toDateKey } from '../domain/dates';
import { computeProgress } from '../domain/progress';
import { dosesOn, groupByTime, indexLogs } from '../domain/schedule';
import type { ScheduledDose } from '../domain/types';
import * as repo from '../db/repo';

export interface WidgetData {
  done: number;
  total: number;
  streak: number;
  /** The earliest time today with doses still open. */
  next: { time: string; label: string; names: string; due: boolean; doses: ScheduledDose[] } | null;
}

export function widgetData(now = new Date()): WidgetData {
  const today = toDateKey(now);
  const meds = repo.getMeds();
  const doses = dosesOn(meds, today);
  const logs = indexLogs(repo.getLogs(today, today));
  const names = new Map(meds.map((m) => [m.id, m.name]));
  const open = groupByTime(doses)
    .map((g) => ({ ...g, doses: g.doses.filter((d) => !logs.has(d.slot)) }))
    .find((g) => g.doses.length > 0);
  let streak = 0;
  try {
    streak = computeProgress(repo.getDaySummaries(today)).currentStreak;
  } catch {
    // keep 0
  }
  const first = open ? (names.get(open.doses[0].medId) ?? 'Medicine') : '';
  return {
    done: doses.filter((d) => logs.has(d.slot)).length,
    total: doses.length,
    streak,
    next: open
      ? {
          time: open.time,
          label: formatTime(open.time),
          names: open.doses.length > 1 ? `${first} +${open.doses.length - 1}` : first,
          due: atTime(today, open.time) <= now,
          doses: open.doses,
        }
      : null,
  };
}

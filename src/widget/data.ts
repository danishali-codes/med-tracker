import { formatTime, toDateKey } from '../domain/dates';
import { describeDose } from '../domain/dose';
import { computeProgress } from '../domain/progress';
import { dosesOn, dueAt, groupByTime, indexLogs } from '../domain/schedule';
import type { ScheduledDose } from '../domain/types';
import * as repo from '../db/repo';

export interface WidgetData {
  done: number;
  total: number;
  streak: number;
  /** The earliest time today with doses still open. */
  next: { time: string; label: string; names: string; due: boolean; doses: ScheduledDose[] } | null;
  /** Every dose today, by time, for the bigger list widget. */
  rows: { slot: string; time: string; label: string; name: string; dose: string; status: 'taken' | 'skipped' | 'open'; due: boolean }[];
}

export function widgetData(now = new Date()): WidgetData {
  const today = toDateKey(now);
  const meds = repo.getMeds();
  const doses = dosesOn(meds, today);
  const logs = indexLogs(repo.getLogs(today, today));
  const names = new Map(meds.map((m) => [m.id, m.name]));
  const byId = new Map(meds.map((m) => [m.id, m]));
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
          due: dueAt(today, open.time) <= now,
          doses: open.doses,
        }
      : null,
    rows: doses.map((d) => {
      const log = logs.get(d.slot);
      const med = byId.get(d.medId);
      return {
        slot: d.slot,
        time: d.time,
        label: formatTime(d.time),
        name: med?.name ?? 'Medicine',
        dose: med ? describeDose(med) : '',
        status: log ? log.status : 'open',
        due: dueAt(today, d.time) <= now,
      };
    }),
  };
}

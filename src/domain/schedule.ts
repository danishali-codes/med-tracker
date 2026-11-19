import { addDays, daysInMonth, toDateKey, diffDays, ordinal, parseDateKey, weekdayOf, weekdayShort, formatTime, type DateKey, type TimeOfDay } from './dates';
import type { DoseLog, Medication, Schedule, ScheduledDose } from './types';

export function slotKey(medId: string, date: DateKey, time: TimeOfDay): string {
  return `${medId}|${date}|${time}`;
}

/** Whether a schedule has a dose on the given day (ignores times). */
export function isDueOn(schedule: Schedule, date: DateKey): boolean {
  const { pattern, startDate, endDate } = schedule;
  if (pattern.kind === 'asNeeded') return false;
  const since = diffDays(startDate, date);
  if (since < 0) return false;
  if (endDate && diffDays(endDate, date) > 0) return false;

  switch (pattern.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return pattern.days.includes(weekdayOf(date));
    case 'interval': {
      const step = Math.max(1, pattern.every) * (pattern.unit === 'week' ? 7 : 1);
      return since % step === 0;
    }
    case 'cycle': {
      const on = Math.max(1, pattern.onDays);
      const period = on + Math.max(0, pattern.offDays);
      return since % period < on;
    }
    case 'monthly': {
      const { y, m, d } = parseDateKey(date);
      const target = Math.min(pattern.dayOfMonth, daysInMonth(y, m));
      return d === target;
    }
  }
}

/** All scheduled doses on a day, ordered by time. Archived meds are skipped. */
export function dosesOn(meds: Medication[], date: DateKey): ScheduledDose[] {
  const out: ScheduledDose[] = [];
  for (const med of meds) {
    // Archived meds stop being due from the day they were archived, but stay in earlier history.
    if (med.archived && (!med.archivedAt || date >= toDateKey(new Date(med.archivedAt)))) continue;
    if (!isDueOn(med.schedule, date)) continue;
    for (const time of med.schedule.times) {
      out.push({ slot: slotKey(med.id, date, time), medId: med.id, date, time });
    }
  }
  return out.sort((a, b) => (a.time === b.time ? a.medId.localeCompare(b.medId) : a.time < b.time ? -1 : 1));
}

/** Doses grouped by time (one reminder per time slot). */
export function groupByTime(doses: ScheduledDose[]): { time: TimeOfDay; doses: ScheduledDose[] }[] {
  const groups = new Map<TimeOfDay, ScheduledDose[]>();
  for (const d of doses) {
    const g = groups.get(d.time) ?? [];
    g.push(d);
    groups.set(d.time, g);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([time, ds]) => ({ time, doses: ds }));
}

export type Punctuality = 'onTime' | 'late';

/** On time when taken within the window either side of the scheduled time, on the same day. */
export function punctuality(dose: { date: DateKey; time: TimeOfDay }, takenAt: Date, windowMinutes: number): Punctuality {
  const { y, m, d } = parseDateKey(dose.date);
  const [h, min] = dose.time.split(':').map(Number);
  const due = new Date(y, m - 1, d, h, min).getTime();
  return Math.abs(takenAt.getTime() - due) <= windowMinutes * 60_000 ? 'onTime' : 'late';
}

export function indexLogs(logs: DoseLog[]): Map<string, DoseLog> {
  return new Map(logs.map((l) => [l.slot, l]));
}

/** Human summary such as "Every 2 weeks · 8:00 AM, 8:00 PM". */
export function describeSchedule(s: Schedule): string {
  const p = s.pattern;
  let when: string;
  switch (p.kind) {
    case 'daily':
      when = 'Every day';
      break;
    case 'weekdays':
      when = p.days.length === 7 ? 'Every day' : [...p.days].sort().map(weekdayShort).join(', ');
      break;
    case 'interval':
      when =
        p.every === 1
          ? p.unit === 'week'
            ? `Weekly (${weekdayShort(weekdayOf(s.startDate))})`
            : 'Every day'
          : `Every ${p.every} ${p.unit}s`;
      break;
    case 'cycle':
      when = `${p.onDays} days on, ${p.offDays} off`;
      break;
    case 'monthly':
      when = `Monthly on the ${ordinal(p.dayOfMonth)}`;
      break;
    case 'asNeeded':
      return 'As needed';
  }
  const times = s.times.map(formatTime).join(', ');
  return times ? `${when} · ${times}` : when;
}

/** The next day (from `from`, inclusive) a dose is due, searching up to a year ahead. */
export function nextDueDate(s: Schedule, from: DateKey): DateKey | null {
  for (let i = 0; i <= 366; i++) {
    const key = addDays(from, i);
    if (isDueOn(s, key)) return key;
  }
  return null;
}

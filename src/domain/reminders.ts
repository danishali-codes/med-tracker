import { addDays, atTime, formatTime, toDateKey, type DateKey, type TimeOfDay } from './dates';
import { describeDose } from './dose';
import { dosesOn, groupByTime } from './schedule';
import type { DoseLog, Medication, Settings } from './types';

/** One reminder per time slot: all meds due at 8:00 share a notification. */
export function groupKey(date: DateKey, time: TimeOfDay): string {
  return `${date}|${time}`;
}

export const REMINDER_PREFIX = 'dose:';

export function reminderId(group: string, k: number): string {
  return `${REMINDER_PREFIX}${group}|${k}`;
}

export function groupFromReminderId(id: string): string | null {
  if (!id.startsWith(REMINDER_PREFIX)) return null;
  const parts = id.slice(REMINDER_PREFIX.length).split('|');
  return parts.length >= 2 ? `${parts[0]}|${parts[1]}` : null;
}

export interface PlannedReminder {
  id: string;
  at: Date;
  date: DateKey;
  time: TimeOfDay;
  medIds: string[];
  kind: 'due' | 'snoozed' | 'nag';
}

/**
 * Works out every reminder that should be scheduled from now on.
 * - Doses already taken or skipped get no reminder.
 * - A snoozed slot restarts from the snooze time.
 * - With nagging on, follow-ups repeat every N minutes until answered.
 */
export function planReminders(opts: {
  meds: Medication[];
  logs: Map<string, DoseLog>;
  snoozes: Map<string, string>;
  now: Date;
  settings: Settings;
  horizonDays: number;
  maxCount: number;
}): PlannedReminder[] {
  const { meds, logs, snoozes, now, settings, horizonDays, maxCount } = opts;
  const today = toDateKey(now);
  const out: PlannedReminder[] = [];
  const nags = settings.nagEnabled ? Math.max(0, settings.nagCount) : 0;
  const step = Math.max(1, settings.nagEveryMinutes) * 60_000;

  // Start yesterday so a late-night dose's follow-ups past midnight still fire.
  for (let i = -1; i <= horizonDays; i++) {
    const date = addDays(today, i);
    for (const group of groupByTime(dosesOn(meds, date))) {
      const pending = group.doses.filter((d) => !logs.has(d.slot));
      if (pending.length === 0) continue;
      const key = groupKey(date, group.time);
      const base = atTime(date, group.time);
      const snoozedUntil = snoozes.get(key);
      const snoozed = snoozedUntil != null && new Date(snoozedUntil).getTime() > base.getTime();
      const anchor = snoozed ? new Date(snoozedUntil!) : base;
      for (let k = 0; k <= nags; k++) {
        const at = new Date(anchor.getTime() + k * step);
        if (at.getTime() <= now.getTime()) continue;
        out.push({
          id: reminderId(key, k),
          at,
          date,
          time: group.time,
          medIds: pending.map((d) => d.medId),
          kind: k === 0 ? (snoozed ? 'snoozed' : 'due') : 'nag',
        });
      }
    }
  }
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, maxCount);
}

/**
 * The words a reminder shows. Medicine names are only included when the person turned
 * them on, so by default nothing on the lock screen or a watch says what they take.
 */
export function reminderText(
  r: Pick<PlannedReminder, 'kind' | 'time'>,
  meds: Pick<Medication, 'name' | 'strength' | 'amount' | 'form'>[],
  showNames: boolean,
): { title: string; body: string } {
  const when = formatTime(r.time);
  const count = meds.length === 1 ? '1 medicine' : `${meds.length} medicines`;
  if (!showNames) {
    const title = r.kind === 'nag' ? `Still waiting: ${when} dose` : r.kind === 'snoozed' ? `Snoozed reminder: ${when} dose` : `Time for your ${when} dose`;
    return { title, body: `${count} to take` };
  }
  const title =
    r.kind === 'nag'
      ? `Still waiting: ${when} meds`
      : r.kind === 'snoozed'
        ? `Snoozed reminder: ${when} meds`
        : meds.length === 1
          ? `Time for ${meds[0].name}`
          : `Time for your ${when} meds`;
  return { title, body: meds.map((m) => `${m.name} (${describeDose(m)})`).join(', ') };
}

/** Refill alert words, without the name unless the person turned names on. */
export function refillText(name: string, left: string, showNames: boolean): { title: string; body: string } {
  return showNames
    ? { title: `Running low on ${name}`, body: `${left}. Time to order a refill.` }
    : { title: 'Running low on a medicine', body: 'Open the app to see which one needs a refill.' };
}

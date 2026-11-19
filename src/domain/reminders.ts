import { addDays, formatTime, toDateKey, type DateKey, type TimeOfDay } from './dates';
import { describeDose } from './dose';
import { dosesOn, dueAt, groupByTime } from './schedule';
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
  /** The doses this reminder is for (their slot keys), so buttons log the right ones. */
  slots: string[];
  kind: 'due' | 'snoozed' | 'nag' | 'missed';
}

/** Whether a moment falls in quiet hours (which may run past midnight). */
export function inQuietHours(at: Date, q: Settings['quietHours']): boolean {
  if (!q?.enabled) return false;
  const m = at.getHours() * 60 + at.getMinutes();
  const [fh, fm] = q.from.split(':').map(Number);
  const [th, tm] = q.to.split(':').map(Number);
  const from = fh * 60 + fm;
  const to = th * 60 + tm;
  return from <= to ? m >= from && m < to : m >= from || m < to;
}

/** Minutes after the first reminder for each repeat. Escalating: each gap is shorter, never under 5 minutes. */
export function nagOffsets(count: number, every: number, escalate: boolean): number[] {
  const out: number[] = [];
  let t = 0;
  let gap = Math.max(1, every);
  for (let k = 1; k <= count; k++) {
    t += gap;
    out.push(t);
    if (escalate) gap = Math.max(5, Math.round(gap * 0.6));
  }
  return out;
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
  const nags = settings.nagEnabled ? nagOffsets(Math.max(0, settings.nagCount), settings.nagEveryMinutes, !!settings.nagEscalate) : [];

  // Start yesterday so a late-night dose's follow-ups past midnight still fire.
  for (let i = -1; i <= horizonDays; i++) {
    const date = addDays(today, i);
    const unanswered: { medId: string; slot: string; time: TimeOfDay }[] = [];
    for (const group of groupByTime(dosesOn(meds, date))) {
      const pending = group.doses.filter((d) => !logs.has(d.slot));
      if (pending.length === 0) continue;
      const key = groupKey(date, group.time);
      const base = dueAt(date, group.time);
      unanswered.push(...pending.map((d) => ({ medId: d.medId, slot: d.slot, time: group.time })));
      const snoozedUntil = snoozes.get(key);
      const snoozed = snoozedUntil != null && new Date(snoozedUntil).getTime() > base.getTime();
      const anchor = snoozed ? new Date(snoozedUntil!) : base;
      [0, ...nags].forEach((offset, k) => {
        const at = new Date(anchor.getTime() + offset * 60_000);
        if (at.getTime() <= now.getTime()) return;
        if (k > 0 && inQuietHours(at, settings.quietHours)) return;
        out.push({
          id: reminderId(key, k),
          at,
          date,
          time: group.time,
          medIds: pending.map((d) => d.medId),
          slots: pending.map((d) => d.slot),
          kind: k === 0 ? (snoozed ? 'snoozed' : 'due') : 'nag',
        });
      });
    }
    // One last notice in the evening for anything due earlier that day and still unanswered.
    if (settings.missedNotice && unanswered.length > 0) {
      const base = dueAt(date, settings.missedNoticeAt);
      const earlier = unanswered.filter((u) => dueAt(date, u.time).getTime() < base.getTime());
      // Snooze on this notice brings it back later, like any other reminder.
      const snoozedUntil = snoozes.get(groupKey(date, 'missed'));
      const at = snoozedUntil != null && new Date(snoozedUntil).getTime() > base.getTime() ? new Date(snoozedUntil) : base;
      if (earlier.length > 0 && at.getTime() > now.getTime()) {
        out.push({
          id: reminderId(groupKey(date, 'missed'), 0),
          at,
          date,
          time: settings.missedNoticeAt,
          medIds: earlier.map((u) => u.medId),
          slots: earlier.map((u) => u.slot),
          kind: 'missed',
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
  if (r.kind === 'missed') {
    if (!showNames) return { title: meds.length === 1 ? 'Did you take your medicine?' : `${meds.length} doses not logged today`, body: 'Tap Taken if you already had them.' };
    const list = meds.map((m) => `${m.name} (${describeDose(m)})`).join(', ');
    return { title: meds.length === 1 ? `Did you take ${meds[0].name}?` : `${meds.length} doses not logged today`, body: `${list}. Tap Taken if you already had them.` };
  }
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

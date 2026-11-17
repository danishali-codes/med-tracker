import type { DateKey, TimeOfDay } from './dates';

export type SchedulePattern =
  | { kind: 'daily' }
  /** days: 0 = Sunday ... 6 = Saturday */
  | { kind: 'weekdays'; days: number[] }
  /** Every N days or weeks, counted from the start date (e.g. every 2 weeks). */
  | { kind: 'interval'; every: number; unit: 'day' | 'week' }
  /** X days on, Y days off, repeating from the start date (e.g. 21 on / 7 off). */
  | { kind: 'cycle'; onDays: number; offDays: number }
  /** Once a month on this day (31 falls back to the month's last day). */
  | { kind: 'monthly'; dayOfMonth: number }
  /** No reminders; logged by hand from the Today screen. */
  | { kind: 'asNeeded' };

export interface Schedule {
  pattern: SchedulePattern;
  /** Times of day the dose is due, sorted "HH:MM". Empty for as-needed. */
  times: TimeOfDay[];
  startDate: DateKey;
  endDate?: DateKey | null;
}

export type MedForm = 'pill' | 'capsule' | 'liquid' | 'injection' | 'drops' | 'inhaler' | 'patch' | 'other';

export interface Medication {
  id: string;
  name: string;
  /** Free text, e.g. "500 mg" or "2 puffs". */
  dose: string;
  form: MedForm;
  color: string;
  notes?: string;
  schedule: Schedule;
  /** Units on hand; null when stock isn't tracked. */
  stock: number | null;
  /** Units used per dose (decrements stock). */
  perDose: number;
  /** Alert when stock falls to this many units or fewer. */
  refillAt: number | null;
  archived: boolean;
  createdAt: string;
}

export type DoseStatus = 'taken' | 'skipped';

/** A recorded dose. The slot identifies which scheduled dose it answers. */
export interface DoseLog {
  slot: string;
  medId: string;
  date: DateKey;
  time: TimeOfDay;
  status: DoseStatus;
  /** ISO timestamp of when it was taken or skipped. */
  at: string;
}

/** A dose the schedule says is due. */
export interface ScheduledDose {
  slot: string;
  medId: string;
  date: DateKey;
  time: TimeOfDay;
}

export interface Settings {
  /** Use Android's alarm-clock delivery so reminders are never delayed by battery saving. */
  alarmStyle: boolean;
  /** Keep re-alerting until the dose is answered. */
  nagEnabled: boolean;
  nagEveryMinutes: number;
  nagCount: number;
  snoozeMinutes: number;
  /** A dose within this many minutes of its time counts as on time. */
  onTimeWindowMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  alarmStyle: true,
  nagEnabled: true,
  nagEveryMinutes: 15,
  nagCount: 3,
  snoozeMinutes: 10,
  onTimeWindowMinutes: 60,
};

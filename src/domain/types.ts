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

/** 'pill' is shown as "Tablet" (kept as the stored key so older data still reads). */
export type MedForm = 'pill' | 'capsule' | 'liquid' | 'injection' | 'drops' | 'inhaler' | 'patch' | 'cream' | 'sachet' | 'other';

export interface Medication {
  id: string;
  name: string;
  /** Strength of one unit, free text, e.g. "500 mg" or "5 mg/ml". */
  strength: string;
  /** How many units make one dose, e.g. 3 (tablets) or 5 (ml). Can be a fraction like 0.5. */
  amount: number;
  form: MedForm;
  /** Active ingredient(s), e.g. "paracetamol", filled from the medicine search. Used for interaction checks. */
  generic?: string | null;
  /** RxNorm concept id, when picked from the medicine search. */
  rxcui?: string | null;
  color: string;
  notes?: string;
  schedule: Schedule;
  /** Units (tablets, ml...) on hand; null when stock isn't tracked. Each dose uses `amount` units. */
  stock: number | null;
  /** Alert when stock falls to this many units or fewer. */
  refillAt: number | null;
  archived: boolean;
  /** Breaks (e.g. "stop for a week"): no doses or reminders, and the streak isn't affected. `to` null = until resumed. */
  pauses?: { from: DateKey; to: DateKey | null }[];
  /** When it was archived; doses before this still show in history. */
  archivedAt?: string | null;
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
  /** Light, dark, or follow the phone. */
  appearance: 'system' | 'light' | 'dark';
  /** Confetti when the day's doses are all done. */
  celebrate: boolean;
  /** Pure black backgrounds in dark mode (saves battery on OLED screens). */
  trueBlack: boolean;
  /**
   * Offline mode: the app never goes online. Medicine search and the interaction check
   * use only the built-in list (and anything already saved on the phone).
   */
  offline: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  alarmStyle: true,
  nagEnabled: true,
  nagEveryMinutes: 15,
  nagCount: 3,
  snoozeMinutes: 10,
  onTimeWindowMinutes: 60,
  appearance: 'system',
  celebrate: true,
  trueBlack: false,
  offline: false,
};

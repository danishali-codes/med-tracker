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
  /**
   * Different times on some weekdays, e.g. Mon and Tue at 06:45. Each rule's times
   * replace `times` in order on those days (the first rule that lists a day wins).
   */
  dayTimes?: DayTimes[];
}

export interface DayTimes {
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  times: TimeOfDay[];
}

/** "From 24 to 30 Nov, remind me at 9:00 instead of 8:00", for one med or all. Ends by itself. */
export interface TimeChange {
  id: string;
  from: DateKey;
  to: DateKey;
  /** null = every medication */
  medIds: string[] | null;
  /** Move every dose by this many minutes (can be negative)... */
  shiftMinutes?: number;
  /** ...or move doses at one time to another. */
  moveFrom?: TimeOfDay;
  moveTo?: TimeOfDay;
}

export type PrayerMethod = 'uae' | 'ummalqura' | 'mwl' | 'isna' | 'egypt' | 'karachi';

export interface RamadanSettings {
  enabled: boolean;
  from: DateKey;
  to: DateKey;
  /** null = every medication */
  medIds: string[] | null;
  /** Set the times yourself, or work them out from a city's prayer times. */
  mode: 'manual' | 'city';
  suhoor: TimeOfDay;
  iftar: TimeOfDay;
  cityId: string | null;
  method: PrayerMethod;
  /** City mode: suhoor dose this many minutes before Fajr, iftar dose this many after Maghrib. */
  suhoorBeforeFajr: number;
  iftarAfterMaghrib: number;
}

/** 'pill' is shown as "Tablet" (kept as the stored key so older data still reads). */
export type MedForm = 'pill' | 'capsule' | 'liquid' | 'injection' | 'drops' | 'inhaler' | 'patch' | 'cream' | 'sachet' | 'other';

export type PillShape = 'round' | 'oval' | 'oblong' | 'capsule' | 'square' | 'diamond' | 'triangle';

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
  /** Accent colour used for the med's rings, tags and icon background. */
  color: string;
  /** What the pill looks like (tablets and capsules). */
  shape?: PillShape;
  /** Colour of the pill, or of the bottle/pen/etc. for other forms. */
  pillColor?: string;
  /** Second half of a two-colour capsule. */
  pillColor2?: string | null;
  /** A photo of the pill, stored on the phone only. */
  photo?: string | null;
  /** The box's barcode, so scanning it again finds this medicine. */
  barcode?: string | null;
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
  /** When it's due on this day, after weekday times, Ramadan and temporary changes. */
  time: TimeOfDay;
  /** The usual time from the schedule, when it was moved. */
  usualTime?: TimeOfDay;
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
  /** Keep reminders on home time while abroad, instead of following the phone's clock. */
  travelMode: boolean;
  /** The home time zone (IANA name) used when travel mode is on. */
  homeTimeZone: string | null;
  ramadan: RamadanSettings;
  timeChanges: TimeChange[];
  /** No repeat reminders in these hours (the first reminder still comes). */
  quietHours: { enabled: boolean; from: TimeOfDay; to: TimeOfDay };
  /** One last notice in the evening listing doses not answered yet. */
  missedNotice: boolean;
  missedNoticeAt: TimeOfDay;
  /** Repeat reminders come closer together each time. */
  nagEscalate: boolean;
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
  travelMode: false,
  homeTimeZone: null,
  ramadan: {
    enabled: false,
    from: '2027-02-08',
    to: '2027-03-09',
    medIds: null,
    mode: 'manual',
    suhoor: '04:30',
    iftar: '18:15',
    cityId: null,
    method: 'uae',
    suhoorBeforeFajr: 30,
    iftarAfterMaghrib: 0,
  },
  timeChanges: [],
  quietHours: { enabled: false, from: '23:00', to: '07:00' },
  missedNotice: true,
  missedNoticeAt: '22:00',
  nagEscalate: false,
};

/** How the day went: a mood from 1 (awful) to 5 (great), symptom tags and free text. */
export interface DayNote {
  date: DateKey;
  mood: 1 | 2 | 3 | 4 | 5 | null;
  symptoms: string[];
  text: string;
}

export const MOODS: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: 'Awful' },
  { value: 2, label: 'Bad' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

export const COMMON_SYMPTOMS = ['Headache', 'Nausea', 'Dizzy', 'Tired', 'Stomach ache', 'Sleepy', "Can't sleep", 'Anxious', 'Low mood', 'Pain', 'Rash', 'Dry mouth'];

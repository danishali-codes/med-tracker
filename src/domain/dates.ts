// Local-calendar date helpers. A "date key" is a local calendar day as "YYYY-MM-DD".
// All schedule maths is done on date keys so daylight-saving and time zones
// never shift a dose onto the wrong day.

export type DateKey = string; // "YYYY-MM-DD"
export type TimeOfDay = string; // "HH:MM" (24h)

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: DateKey): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** Local midnight of the given day. */
export function dateFromKey(key: DateKey): Date {
  const { y, m, d } = parseDateKey(key);
  return new Date(y, m - 1, d);
}

/** Whole days from a to b (b - a), immune to DST because it uses UTC day numbers. */
export function diffDays(a: DateKey, b: DateKey): number {
  const pa = parseDateKey(a);
  const pb = parseDateKey(b);
  const ua = Date.UTC(pa.y, pa.m - 1, pa.d);
  const ub = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((ub - ua) / 86_400_000);
}

export function addDays(key: DateKey, n: number): DateKey {
  const { y, m, d } = parseDateKey(key);
  const u = new Date(Date.UTC(y, m - 1, d + n));
  return `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(key: DateKey): number {
  const { y, m, d } = parseDateKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function parseTime(t: TimeOfDay): { h: number; min: number } {
  const [h, min] = t.split(':').map(Number);
  return { h, min };
}

export function isValidTime(t: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return false;
  return Number(m[1]) < 24 && Number(m[2]) < 60;
}

export function normalizeTime(t: string): TimeOfDay {
  const { h, min } = parseTime(t);
  return `${pad(h)}:${pad(min)}`;
}

export function timeFromDate(d: Date): TimeOfDay {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The local Date for a time on a given day. */
export function atTime(key: DateKey, t: TimeOfDay): Date {
  const { y, m, d } = parseDateKey(key);
  const { h, min } = parseTime(t);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

export function compareTime(a: TimeOfDay, b: TimeOfDay): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function weekdayShort(i: number): string {
  return WEEKDAY_SHORT[i];
}

export function monthName(m: number): string {
  return MONTHS[m - 1];
}

/** "8:00 AM" style label. */
export function formatTime(t: TimeOfDay): string {
  const { h, min } = parseTime(t);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(min)} ${suffix}`;
}

export function formatDateLong(key: DateKey): string {
  const { y, m, d } = parseDateKey(key);
  return `${WEEKDAY_SHORT[weekdayOf(key)]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

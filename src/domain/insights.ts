import { addDays, daysInMonth, diffDays, eachDay, monthName, parseTime, type DateKey, type TimeOfDay } from './dates';
import { consistencySeries, isFullDay, isGoldDay, trackedFrom, type DaySummary } from './progress';
import { isMedDueOn, slotKey } from './schedule';
import type { DayNote, DoseLog, Medication } from './types';

// Everything here runs on the phone, from data already on the phone.

// ---------------------------------------------------------------------------
// Month and year in review
// ---------------------------------------------------------------------------

export interface Review {
  title: string;
  from: DateKey;
  to: DateKey;
  /** Days that had at least one dose due. */
  daysWithDoses: number;
  scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  onTime: number;
  /** Share of due doses taken (skips left out), or null when nothing was due. */
  takenPct: number | null;
  onTimePct: number | null;
  /** Days with every dose done. */
  perfectDays: number;
  /** Days with every dose done on time. */
  goldDays: number;
  missedDays: number;
  freezesUsed: number;
  /** Longest run of complete days inside the period. */
  longestRun: number;
  consistencyStart: number;
  consistencyEnd: number;
  /** The part of the day with the most missed doses, when there were any. */
  hardestTime: { label: string; missed: number } | null;
  moodAverage: number | null;
  moodDays: number;
  topSymptoms: { name: string; days: number }[];
  /** Taken percentage per month (year review) or per week (month review), for a small chart. */
  parts: { label: string; pct: number | null }[];
}

export function monthRange(y: number, m: number): { from: DateKey; to: DateKey } {
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(daysInMonth(y, m)).padStart(2, '0')}` };
}

const PARTS_OF_DAY: { label: string; from: number; to: number }[] = [
  { label: 'Night (before 6 AM)', from: 0, to: 6 },
  { label: 'Morning', from: 6, to: 12 },
  { label: 'Afternoon', from: 12, to: 17 },
  { label: 'Evening', from: 17, to: 21 },
  { label: 'Late evening', from: 21, to: 24 },
];

function partOfDay(t: TimeOfDay): string {
  const h = parseTime(t).h;
  return PARTS_OF_DAY.find((p) => h >= p.from && h < p.to)?.label ?? 'Morning';
}

/**
 * Sums up a month or a year. `summaries` must cover the period (and ideally the weeks
 * before it, for the consistency score); `doses` are the doses that were due, used only
 * to find the hardest time of day.
 */
export function buildReview(opts: {
  kind: 'month' | 'year';
  y: number;
  m?: number;
  summaries: DaySummary[];
  frozenDays: Set<DateKey>;
  notes: DayNote[];
  logs: Map<string, DoseLog>;
  dueDoses: { slot: string; date: DateKey; time: TimeOfDay }[];
  today: DateKey;
}): Review {
  const { kind, y, summaries, notes, logs, today } = opts;
  const range = kind === 'month' ? monthRange(y, opts.m!) : { from: `${y}-01-01`, to: `${y}-12-31` };
  const to = range.to < today ? range.to : addDays(today, -1);
  const inRange = summaries.filter((s) => s.date >= range.from && s.date <= to);

  let scheduled = 0,
    taken = 0,
    skipped = 0,
    onTime = 0,
    perfectDays = 0,
    goldDays = 0,
    missedDays = 0,
    daysWithDoses = 0,
    run = 0,
    longestRun = 0,
    freezesUsed = 0;
  for (const s of inRange) {
    scheduled += s.scheduled;
    taken += s.taken;
    skipped += s.skipped;
    onTime += s.onTime;
    if (s.scheduled > 0) daysWithDoses++;
    if (isFullDay(s)) perfectDays++;
    if (isGoldDay(s)) goldDays++;
    if (s.status === 'partial' || s.status === 'missed') missedDays++;
    if (opts.frozenDays.has(s.date)) freezesUsed++;
    if (s.status === 'complete') longestRun = Math.max(longestRun, ++run);
    else if (s.status === 'partial' || s.status === 'missed') run = 0;
  }
  const missed = Math.max(0, scheduled - taken - skipped);
  const due = scheduled - skipped;

  const series = consistencySeries(summaries.filter((s) => s.date <= to));
  const at = (d: DateKey) => {
    let v = 0;
    for (const p of series) {
      if (p.date > d) break;
      v = p.score;
    }
    return v;
  };

  const missedByPart = new Map<string, number>();
  for (const d of opts.dueDoses) {
    if (d.date < range.from || d.date > to) continue;
    if (logs.has(d.slot)) continue;
    const label = partOfDay(d.time);
    missedByPart.set(label, (missedByPart.get(label) ?? 0) + 1);
  }
  const worst = [...missedByPart.entries()].sort((a, b) => b[1] - a[1])[0];

  const periodNotes = notes.filter((n) => n.date >= range.from && n.date <= to);
  const moods = periodNotes.map((n) => n.mood).filter((m): m is 1 | 2 | 3 | 4 | 5 => m != null);
  const symptomDays = new Map<string, number>();
  for (const n of periodNotes) for (const sy of new Set(n.symptoms)) symptomDays.set(sy, (symptomDays.get(sy) ?? 0) + 1);

  const parts: { label: string; pct: number | null }[] = [];
  if (kind === 'year') {
    for (let m = 1; m <= 12; m++) {
      const r = monthRange(y, m);
      parts.push({ label: monthName(m).slice(0, 1), pct: takenShare(inRange.filter((s) => s.date >= r.from && s.date <= r.to)) });
    }
  } else {
    // Weeks of the month: days 1-7, 8-14, 15-21, 22-28, 29+.
    const r = monthRange(y, opts.m!);
    for (let w = 0; w * 7 < diffDays(r.from, r.to) + 1; w++) {
      const a = addDays(r.from, w * 7);
      const b = addDays(r.from, w * 7 + 6);
      parts.push({ label: `${w * 7 + 1}`, pct: takenShare(inRange.filter((s) => s.date >= a && s.date <= b)) });
    }
  }

  return {
    title: kind === 'month' ? `${monthName(opts.m!)} ${y}` : `${y}`,
    from: range.from,
    to,
    daysWithDoses,
    scheduled,
    taken,
    skipped,
    missed,
    onTime,
    takenPct: due > 0 ? taken / due : null,
    onTimePct: taken > 0 ? onTime / taken : null,
    perfectDays,
    goldDays,
    missedDays,
    freezesUsed,
    longestRun,
    consistencyStart: at(addDays(range.from, -1)),
    consistencyEnd: at(to),
    hardestTime: worst && worst[1] > 0 ? { label: worst[0], missed: worst[1] } : null,
    moodAverage: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
    moodDays: moods.length,
    topSymptoms: [...symptomDays.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, days]) => ({ name, days })),
    parts,
  };
}

function takenShare(days: DaySummary[]): number | null {
  let due = 0,
    taken = 0;
  for (const s of days) {
    due += s.scheduled - s.skipped;
    taken += s.taken;
  }
  return due > 0 ? taken / due : null;
}

/** The month whose review to offer: last month, once it has finished. */
export function lastMonth(today: DateKey): { y: number; m: number } {
  const [y, m] = today.split('-').map(Number);
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}

// ---------------------------------------------------------------------------
// Patterns: how you felt against how the doses went
// ---------------------------------------------------------------------------

export interface Pattern {
  id: string;
  title: string;
  detail: string;
  /** Bigger = a clearer difference. Used for ordering only. */
  weight: number;
}

const MIN_DAYS = 4;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Compares mood and symptoms on days after doses were missed with days after everything was
 * taken. Only shows a pattern when both sides have a few days behind them. These are just
 * coincidences in your own notes, not medical findings.
 */
export function findPatterns(opts: {
  summaries: DaySummary[];
  notes: DayNote[];
  meds: Medication[];
  logs: Map<string, DoseLog>;
}): Pattern[] {
  const { summaries, notes, meds, logs } = opts;
  const byDate = new Map(summaries.map((s) => [s.date, s]));
  const out: Pattern[] = [];

  // Mood on the same day and the day after.
  for (const lag of [0, 1] as const) {
    const good: number[] = [];
    const bad: number[] = [];
    for (const n of notes) {
      if (n.mood == null) continue;
      const s = byDate.get(addDays(n.date, -lag));
      if (!s || s.scheduled === 0) continue;
      if (s.status === 'complete') good.push(n.mood);
      else if (s.status === 'partial' || s.status === 'missed') bad.push(n.mood);
    }
    if (good.length >= MIN_DAYS && bad.length >= MIN_DAYS) {
      const diff = avg(good) - avg(bad);
      if (Math.abs(diff) >= 0.4) {
        const when = lag === 0 ? 'on days you' : 'the day after you';
        out.push({
          id: `mood-${lag}`,
          title: diff > 0 ? `Your mood is better ${when} take every dose` : `Your mood is lower ${when} take every dose`,
          detail: `Average mood ${moodWord(avg(good))} (${good.length} days) against ${moodWord(avg(bad))} when doses were missed (${bad.length} days).`,
          weight: Math.abs(diff),
        });
      }
    }
  }

  // Each symptom the day after a miss against the day after a complete day.
  const symptoms = new Set(notes.flatMap((n) => n.symptoms));
  for (const sy of symptoms) {
    let afterGood = 0,
      afterGoodWith = 0,
      afterBad = 0,
      afterBadWith = 0;
    for (const n of notes) {
      const prev = byDate.get(addDays(n.date, -1));
      if (!prev || prev.scheduled === 0) continue;
      const has = n.symptoms.includes(sy);
      if (prev.status === 'complete') {
        afterGood++;
        if (has) afterGoodWith++;
      } else if (prev.status === 'partial' || prev.status === 'missed') {
        afterBad++;
        if (has) afterBadWith++;
      }
    }
    if (afterGood < MIN_DAYS || afterBad < MIN_DAYS || afterGoodWith + afterBadWith < 3) continue;
    const a = afterBadWith / afterBad;
    const b = afterGoodWith / afterGood;
    if (Math.abs(a - b) < 0.25) continue;
    out.push({
      id: `symptom-${sy}`,
      title: a > b ? `${sy} shows up more after a missed dose` : `${sy} shows up less after a missed dose`,
      detail: `Noted on ${pct(a)} of days after a miss (${afterBadWith} of ${afterBad}) and ${pct(b)} of days after taking everything (${afterGoodWith} of ${afterGood}).`,
      weight: Math.abs(a - b) * 2,
    });
  }

  // Per medicine: mood the day after it was missed.
  for (const med of meds) {
    if (med.schedule.pattern.kind === 'asNeeded') continue;
    const taken: number[] = [];
    const missed: number[] = [];
    for (const n of notes) {
      if (n.mood == null) continue;
      const d = addDays(n.date, -1);
      const s = byDate.get(d);
      if (!s || s.scheduled === 0) continue;
      if (diffDays(trackedFrom(med), d) < 0 || !isMedDueOn(med, d)) continue;
      const slots = med.schedule.times.map((t) => logs.get(slotKey(med.id, d, t)));
      if (slots.length === 0) continue;
      if (slots.every((x) => x?.status === 'taken')) taken.push(n.mood);
      else if (slots.some((x) => !x)) missed.push(n.mood);
    }
    if (taken.length >= MIN_DAYS && missed.length >= 3) {
      const diff = avg(taken) - avg(missed);
      if (Math.abs(diff) >= 0.5) {
        out.push({
          id: `med-${med.id}`,
          title: `${med.name}: mood ${diff > 0 ? 'drops' : 'rises'} the day after it's missed`,
          detail: `${moodWord(avg(missed))} after missing it (${missed.length} days), ${moodWord(avg(taken))} after taking it (${taken.length} days).`,
          weight: Math.abs(diff),
        });
      }
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
}

function moodWord(v: number): string {
  const words = ['awful', 'bad', 'okay', 'good', 'great'];
  return `${words[Math.max(0, Math.min(4, Math.round(v) - 1))]} (${v.toFixed(1)})`;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** How many days with a mood note there are, to say how far off patterns are. */
export function patternReadiness(notes: DayNote[]): { moodDays: number; needed: number } {
  return { moodDays: notes.filter((n) => n.mood != null).length, needed: MIN_DAYS * 2 };
}

// ---------------------------------------------------------------------------
// Smart reminder timing
// ---------------------------------------------------------------------------

export interface TimingSuggestion {
  /** The reminder time as set now. */
  time: TimeOfDay;
  /** Where it would move to (rounded to 5 minutes). */
  suggested: TimeOfDay;
  /** Typical minutes between the reminder and taking the dose (negative = early). */
  typicalOffset: number;
  samples: number;
  medIds: string[];
}

const SAMPLE_DAYS = 21;
const MIN_SAMPLES = 7;
const MIN_SHIFT = 20;

/**
 * Looks at when doses due at each reminder time were actually taken over the last three
 * weeks. When it's consistently 20+ minutes off (in the same direction most days), suggests
 * moving the reminder to the usual time.
 */
export function suggestTimings(meds: Medication[], logs: DoseLog[], today: DateKey): TimingSuggestion[] {
  const from = addDays(today, -SAMPLE_DAYS);
  const active = meds.filter((m) => !m.archived && m.schedule.pattern.kind !== 'asNeeded');
  const byTime = new Map<TimeOfDay, { offsets: Map<DateKey, number>; medIds: Set<string> }>();
  for (const m of active) {
    for (const t of m.schedule.times) {
      const e = byTime.get(t) ?? { offsets: new Map(), medIds: new Set<string>() };
      e.medIds.add(m.id);
      byTime.set(t, e);
    }
  }
  const medIds = new Set(active.map((m) => m.id));
  for (const l of logs) {
    if (l.status !== 'taken' || !medIds.has(l.medId) || l.date < from || l.date >= today) continue;
    const e = byTime.get(l.time);
    if (!e || !e.medIds.has(l.medId)) continue;
    const at = new Date(l.at);
    const [y, mo, d] = l.date.split('-').map(Number);
    const { h, min } = parseTime(l.time);
    const due = new Date(y, mo - 1, d, h, min);
    const off = Math.round((at.getTime() - due.getTime()) / 60_000);
    if (Math.abs(off) > 6 * 60) continue; // logged much later by hand, not a timing signal
    // One sample per day per time: the first dose taken.
    const prev = e.offsets.get(l.date);
    if (prev == null || off < prev) e.offsets.set(l.date, off);
  }

  const out: TimingSuggestion[] = [];
  for (const [time, e] of byTime) {
    const offs = [...e.offsets.values()].sort((a, b) => a - b);
    if (offs.length < MIN_SAMPLES) continue;
    const median = offs[Math.floor(offs.length / 2)];
    if (Math.abs(median) < MIN_SHIFT) continue;
    const sameSide = offs.filter((o) => Math.sign(o) === Math.sign(median) && Math.abs(o) >= MIN_SHIFT / 2).length;
    if (sameSide / offs.length < 0.7) continue;
    const { h, min } = parseTime(time);
    let total = h * 60 + min + median;
    total = Math.round(total / 5) * 5;
    if (total < 0 || total >= 24 * 60) continue; // would cross midnight; leave it alone
    const suggested = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    if (suggested === time) continue;
    out.push({ time, suggested, typicalOffset: median, samples: offs.length, medIds: [...e.medIds] });
  }
  return out.sort((a, b) => (a.time < b.time ? -1 : 1));
}

/** Moves a reminder time on every listed med (including weekday-specific times). */
export function moveTime(med: Medication, from: TimeOfDay, to: TimeOfDay): Medication {
  const swap = (ts: TimeOfDay[]) => [...new Set(ts.map((t) => (t === from ? to : t)))].sort();
  return {
    ...med,
    schedule: {
      ...med.schedule,
      times: swap(med.schedule.times),
      dayTimes: med.schedule.dayTimes?.map((r) => ({ ...r, times: swap(r.times) })),
    },
  };
}

/** Days covered, for screens that need to load data for a review. */
export function reviewDays(from: DateKey, to: DateKey): DateKey[] {
  return eachDay(from, to);
}

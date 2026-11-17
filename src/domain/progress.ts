import { addDays, diffDays, parseDateKey, daysInMonth, toDateKey, type DateKey } from './dates';
import { dosesOn, isDueOn, punctuality, slotKey } from './schedule';
import type { DoseLog, Medication } from './types';

/**
 * Streak rules (agreed with Danish):
 * - A dose taken any time on the day it's due counts. Taking it late marks it "late"
 *   (fewer coins) but never breaks the streak.
 * - A day breaks the streak only when a scheduled dose is never taken or skipped that day.
 * - Skipping on purpose (e.g. doctor said so) is neutral.
 * - Days with no scheduled doses are neutral.
 * - Every 7 perfect days in a row earns a streak freeze (max 2). A freeze is spent
 *   automatically on a missed day so one bad day doesn't wipe out a long streak.
 */

export type DayStatus = 'none' | 'complete' | 'partial' | 'missed' | 'pending';

export interface DaySummary {
  date: DateKey;
  scheduled: number;
  taken: number;
  onTime: number;
  late: number;
  skipped: number;
  status: DayStatus;
}

export const COINS = {
  onTime: 10,
  late: 5,
  perfectDay: 20,
  milestones: { 7: 50, 30: 150, 100: 500, 365: 1000 } as Record<number, number>,
} as const;

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export function summarizeDay(
  meds: Medication[],
  logs: Map<string, DoseLog>,
  date: DateKey,
  today: DateKey,
  windowMinutes: number,
): DaySummary {
  // As-needed doses are left out on purpose: they shouldn't earn coins or badges,
  // so the app never nudges anyone to take more of an as-needed medicine.
  // Days before a med was added don't count against you, even if its schedule
  // starts earlier (an earlier start date only anchors "every 2 weeks" style schedules).
  const doses = dosesOn(meds.filter((m) => trackedFrom(m) <= date), date);
  let taken = 0,
    onTime = 0,
    late = 0,
    skipped = 0;
  for (const d of doses) {
    const log = logs.get(d.slot);
    if (!log) continue;
    if (log.status === 'skipped') {
      skipped++;
      continue;
    }
    taken++;
    if (punctuality(d, new Date(log.at), windowMinutes) === 'onTime') onTime++;
    else late++;
  }
  const scheduled = doses.length;
  const resolved = taken + skipped;
  let status: DayStatus;
  if (scheduled === 0) status = 'none';
  else if (resolved === scheduled) status = 'complete';
  else if (diffDays(date, today) <= 0) status = 'pending';
  else status = resolved > 0 ? 'partial' : 'missed';
  return { date, scheduled, taken, onTime, late, skipped, status };
}

/** The first day a med counts towards streaks: the later of its start date and the day it was added. */
export function trackedFrom(med: Medication): DateKey {
  const added = toDateKey(new Date(med.createdAt));
  return added > med.schedule.startDate ? added : med.schedule.startDate;
}

export function dayCoins(s: DaySummary): number {
  return s.onTime * COINS.onTime + s.late * COINS.late + (s.status === 'complete' && s.taken > 0 ? COINS.perfectDay : 0);
}

export interface Progress {
  currentStreak: number;
  bestStreak: number;
  freezes: number;
  frozenDays: Set<DateKey>;
  perfectDays: number;
  totalTaken: number;
  totalOnTime: number;
  perfectMonths: number;
  coinsEarned: number;
}

/** Walks every day in order (oldest first, ending today) and derives streaks and coins. */
export function computeProgress(days: DaySummary[]): Progress {
  let streak = 0,
    best = 0,
    freezes = 0,
    perfectDays = 0,
    totalTaken = 0,
    totalOnTime = 0,
    coins = 0;
  const frozenDays = new Set<DateKey>();

  for (const s of days) {
    totalTaken += s.taken;
    totalOnTime += s.onTime;
    coins += dayCoins(s);
    switch (s.status) {
      case 'none':
      case 'pending':
        break;
      case 'complete':
        streak++;
        perfectDays++;
        if (streak % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
        coins += COINS.milestones[streak] ?? 0;
        best = Math.max(best, streak);
        break;
      case 'partial':
      case 'missed':
        if (freezes > 0) {
          freezes--;
          frozenDays.add(s.date);
        } else {
          streak = 0;
        }
        break;
    }
  }

  return {
    currentStreak: streak,
    bestStreak: best,
    freezes,
    frozenDays,
    perfectDays,
    totalTaken,
    totalOnTime,
    perfectMonths: countPerfectMonths(days),
    coinsEarned: coins,
  };
}

/** Finished calendar months where every day with doses was complete. */
function countPerfectMonths(days: DaySummary[]): number {
  if (days.length === 0) return 0;
  const today = days[days.length - 1].date;
  const byMonth = new Map<string, DaySummary[]>();
  for (const s of days) {
    const k = s.date.slice(0, 7);
    const arr = byMonth.get(k) ?? [];
    arr.push(s);
    byMonth.set(k, arr);
  }
  let count = 0;
  for (const [k, list] of byMonth) {
    const { y, m } = parseDateKey(`${k}-01`);
    const last = `${k}-${String(daysInMonth(y, m)).padStart(2, '0')}`;
    if (diffDays(last, today) <= 0) continue; // month not finished
    if (list.length < daysInMonth(y, m)) continue; // tracking started mid-month
    if (list.some((s) => s.status === 'complete') && list.every((s) => s.status === 'complete' || s.status === 'none')) count++;
  }
  return count;
}

/** Consecutive due-days (back from today) on which every dose of this med was answered. */
export function medStreak(med: Medication, logs: Map<string, DoseLog>, today: DateKey): number {
  let n = 0;
  for (let i = 0; i < 800; i++) {
    const date = addDays(today, -i);
    if (diffDays(trackedFrom(med), date) < 0) break;
    if (!isDueOn(med.schedule, date)) continue;
    const answered = med.schedule.times.every((t) => logs.has(slotKey(med.id, date, t)));
    if (answered) n++;
    else if (i === 0) continue; // today still in progress
    else break;
  }
  return n;
}

export interface BadgeDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned: (s: BadgeStats) => boolean;
}

export interface BadgeStats extends Progress {
  purchases: number;
}

export const BADGES: BadgeDef[] = [
  { id: 'first_dose', name: 'First step', emoji: '🌱', description: 'Log your first dose', earned: (s) => s.totalTaken >= 1 },
  { id: 'perfect_day', name: 'Perfect day', emoji: '⭐', description: 'Take every dose in a day', earned: (s) => s.perfectDays >= 1 },
  { id: 'streak_7', name: 'One week strong', emoji: '🔥', description: 'Reach a 7-day streak', earned: (s) => s.bestStreak >= 7 },
  { id: 'streak_30', name: 'Monthly master', emoji: '🏅', description: 'Reach a 30-day streak', earned: (s) => s.bestStreak >= 30 },
  { id: 'streak_100', name: 'Centurion', emoji: '💯', description: 'Reach a 100-day streak', earned: (s) => s.bestStreak >= 100 },
  { id: 'streak_365', name: 'Year of care', emoji: '🏆', description: 'Reach a 365-day streak', earned: (s) => s.bestStreak >= 365 },
  { id: 'doses_100', name: 'Hundred club', emoji: '💊', description: 'Take 100 doses', earned: (s) => s.totalTaken >= 100 },
  { id: 'doses_500', name: 'Dedicated', emoji: '💎', description: 'Take 500 doses', earned: (s) => s.totalTaken >= 500 },
  { id: 'on_time_50', name: 'Like clockwork', emoji: '⏰', description: 'Take 50 doses on time', earned: (s) => s.totalOnTime >= 50 },
  { id: 'perfect_month', name: 'Flawless month', emoji: '🌕', description: 'Finish a calendar month with every dose taken', earned: (s) => s.perfectMonths >= 1 },
  { id: 'decorator', name: 'Home maker', emoji: '🛋️', description: 'Buy your first decoration', earned: (s) => s.purchases >= 1 },
  { id: 'collector', name: 'Collector', emoji: '🎁', description: 'Own 10 decorations', earned: (s) => s.purchases >= 10 },
];

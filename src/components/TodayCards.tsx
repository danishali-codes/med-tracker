import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { addDays, diffDays, formatTime, monthName, timeFromDate, weekdayShort, type DateKey } from '../domain/dates';
import { addDayTime, lastMonth, moveTime, suggestDayTimes, suggestRoutines, suggestTimings } from '../domain/insights';
import { MILESTONES, newMilestone, type Progress } from '../domain/progress';
import type { Medication, Settings } from '../domain/types';
import * as repo from '../db/repo';
import { foodTimer, stopFoodTimer } from '../notifications/food';
import { rescheduleAll } from '../notifications/reminders';
import { makeStyles, useTheme } from '../theme';
import { Button, Card, FadeIn, PressableScale, Text } from './ui';

const MILESTONE_KEY = 'milestone_seen';
const TIMING_KEY = 'timing_dismissed';
const REVIEW_KEY = 'review_seen';

const MILESTONE_WORDS: Record<number, string> = {
  7: 'A full week. The habit is starting to stick.',
  14: 'Two weeks without a break.',
  30: 'A whole month of looking after yourself.',
  60: 'Two months. This is just what you do now.',
  100: 'One hundred days. That takes real patience.',
  180: 'Half a year, day after day.',
  365: 'A full year. Every single day counted.',
  500: 'Five hundred days.',
  730: 'Two years.',
  1000: 'One thousand days.',
};

/** A quiet card the first time a streak reaches 7, 30, 100 days and so on. */
export function MilestoneCard({ progress }: { progress: Progress }) {
  const s = useStyles();
  const c = useTheme();
  let raw = repo.getKv(MILESTONE_KEY);
  if (raw == null) {
    // Someone who already has a long streak when this arrives shouldn't get an old milestone.
    raw = String(MILESTONES.filter((m) => m <= progress.currentStreak).pop() ?? 0);
    repo.setKv(MILESTONE_KEY, raw, false);
  }
  if (progress.currentStreak < Number(raw)) {
    // The streak started over, so its milestones can be reached again.
    raw = String(MILESTONES.filter((m) => m <= progress.currentStreak).pop() ?? 0);
    repo.setKv(MILESTONE_KEY, raw, false);
  }
  const hit = newMilestone(progress.currentStreak, Number(raw));
  if (!hit) return null;
  return (
    <FadeIn>
      <Card style={[s.row, { borderWidth: 1.5, borderColor: c.flame }]}>
        <View style={[s.badge, { backgroundColor: c.flame }]}>
          <Text style={s.badgeNum}>{hit}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{hit}-day streak</Text>
          <Text style={s.text}>{MILESTONE_WORDS[hit] ?? `${hit} days in a row.`}</Text>
        </View>
        <PressableScale onPress={() => repo.setKv(MILESTONE_KEY, String(hit))} hitSlop={10} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={22} color={c.muted} />
        </PressableScale>
      </Card>
    </FadeIn>
  );
}

/** Shown while a broken streak can still be won back. */
export function EarnBackCard({ progress }: { progress: Progress }) {
  const s = useStyles();
  const c = useTheme();
  const e = progress.earnBack;
  if (!e) return null;
  const done = 3 - e.daysLeft;
  return (
    <FadeIn>
      <Card style={s.row}>
        <View style={[s.icon, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="refresh" size={22} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Win back your {e.streak}-day streak</Text>
          <Text style={s.text}>
            Take every dose for {e.daysLeft} more {e.daysLeft === 1 ? 'day' : 'days'} in a row and it comes back.
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < done ? c.primary : c.sunken }} />
            ))}
          </View>
        </View>
      </Card>
    </FadeIn>
  );
}

/** Counts down the wait after an empty-stomach medicine. */
export function FoodTimerCard() {
  const s = useStyles();
  const c = useTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  const until = foodTimer(now);
  if (!until) return null;
  const left = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return (
    <FadeIn>
      <Card style={s.row}>
        <View style={[s.icon, { backgroundColor: c.warnSoft }]}>
          <Ionicons name="restaurant-outline" size={22} color={c.warn} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Eat at {formatTime(timeFromDate(until))}</Text>
          <Text style={s.text}>{left} min to go. You'll get a notice when it's time.</Text>
        </View>
        <Button title="Stop" small kind="secondary" onPress={() => stopFoodTimer().then(() => setNow(new Date()))} />
      </Card>
    </FadeIn>
  );
}

function dismissed(): Record<string, DateKey> {
  try {
    return JSON.parse(repo.getKv(TIMING_KEY) ?? '{}');
  } catch {
    return {};
  }
}

interface Suggestion {
  /** Dismissals are remembered by this for 30 days. */
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  accept: string;
  apply: () => void;
}

const dayList = (days: number[]) => {
  const names = days.map((d) => weekdayShort(d));
  return names.length <= 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/**
 * What the phone has learned from when you actually take your doses, one suggestion at a
 * time: move a reminder, use a different time on certain days, or join two times into one
 * routine. Worked out on the phone; nothing changes until you accept.
 */
export function TimingCard({ meds, settings, today, version }: { meds: Medication[]; settings: Settings; today: DateKey; version: number }) {
  const s = useStyles();
  const c = useTheme();
  const [hidden, setHidden] = useState(0);
  const suggestion = useMemo<Suggestion | null>(() => {
    if (!settings.smartTiming) return null;
    const off = dismissed();
    const fresh = (id: string) => !off[id] || diffDays(off[id], today) >= 30;
    const logs = repo.getLogs(addDays(today, -43), today);
    const nameOf = (ids: string[]) => {
      const names = ids.map((id) => meds.find((m) => m.id === id)?.name).filter(Boolean);
      return names.length === 1 ? names[0]! : 'these doses';
    };
    const save = async (changed: Medication[], routines?: Settings['routines']) => {
      for (const m of changed) {
        const before = repo.getMed(m.id);
        if (before) repo.saveMedRetimed(before, m, today);
      }
      if (routines) repo.saveSettings({ ...repo.getSettings(), routines });
      await rescheduleAll().catch(() => {});
    };

    const timing = suggestTimings(meds, logs.filter((l) => l.date >= addDays(today, -22)), today).find((x) => fresh(x.time));
    if (timing) {
      const { time, suggested, typicalOffset } = timing;
      const routine = settings.routines.find((r) => r.time === time);
      return {
        id: time,
        icon: 'time-outline',
        title: `Move your ${routine ? routine.name : formatTime(time)} reminder?`,
        text: `Over the last 3 weeks you usually took ${nameOf(timing.medIds)} about ${Math.abs(typicalOffset)} min ${typicalOffset > 0 ? 'after' : 'before'} the reminder. Moving it to ${formatTime(suggested)} would match your day.`,
        accept: `Move to ${formatTime(suggested)}`,
        apply: () =>
          save(
            timing.medIds.map((id) => repo.getMed(id)).flatMap((m) => (m ? [moveTime(m, time, suggested)].filter((x): x is Medication => x != null) : [])),
            routine ? settings.routines.map((r) => (r.id === routine.id ? { ...r, time: suggested } : r)) : undefined,
          ),
      };
    }

    const days = suggestDayTimes(meds, logs, today).find((x) => fresh(x.id));
    if (days) {
      return {
        id: days.id,
        icon: 'calendar-outline',
        title: `A different time on ${dayList(days.days)}?`,
        text: `On ${dayList(days.days)} you usually take ${nameOf(days.medIds)} about ${Math.abs(days.typicalOffset)} min ${days.typicalOffset > 0 ? 'later' : 'earlier'} than ${formatTime(days.time)}. Remind you at ${formatTime(days.suggested)} on those days and keep ${formatTime(days.time)} for the rest?`,
        accept: `Use ${formatTime(days.suggested)} then`,
        apply: () =>
          save(days.medIds.map((id) => repo.getMed(id)).flatMap((m) => (m ? [addDayTime(m, days.time, days.days, days.suggested)].filter((x): x is Medication => x != null) : []))),
      };
    }

    const routine = suggestRoutines(meds, logs, today, settings.routines).find((x) => fresh(x.id));
    if (routine) {
      const [t1, t2] = routine.times;
      return {
        id: routine.id,
        icon: 'albums-outline',
        title: `Make a ${routine.name} routine?`,
        text: `You usually take your ${formatTime(t1)} and ${formatTime(t2)} doses together, around ${formatTime(routine.suggested)} (${routine.together} of the last 3 weeks). One reminder at ${formatTime(routine.suggested)} for both would match what you do.`,
        accept: `One reminder at ${formatTime(routine.suggested)}`,
        apply: () => {
          const changed: Medication[] = [];
          for (const id of routine.medIds) {
            const m = repo.getMed(id);
            if (!m) continue;
            const from = m.schedule.times.includes(t1) ? t1 : t2;
            const moved = from === routine.suggested ? m : moveTime(m, from, routine.suggested);
            if (moved && moved !== m) changed.push(moved);
          }
          const kept = settings.routines.filter((r) => r.time !== t1 && r.time !== t2);
          const old = settings.routines.find((r) => r.time === t1 || r.time === t2);
          return save(changed, [...kept, { id: old?.id ?? repo.newId(), name: old?.name ?? routine.name, time: routine.suggested }]);
        },
      };
    }
    return null;
    // `hidden` re-runs this after "Not now" so the next suggestion can show.
  }, [meds, settings.smartTiming, settings.routines, today, version, hidden]);
  if (!suggestion) return null;

  const later = () => {
    repo.setKv(TIMING_KEY, JSON.stringify({ ...dismissed(), [suggestion.id]: today }));
    setHidden((n) => n + 1);
  };

  return (
    <FadeIn>
      <Card>
        <View style={s.row}>
          <View style={[s.icon, { backgroundColor: c.primarySoft }]}>
            <Ionicons name={suggestion.icon} size={22} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{suggestion.title}</Text>
            <Text style={s.text}>{suggestion.text}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <Button title="Not now" kind="secondary" small onPress={later} style={{ flexGrow: 1 }} />
          <Button title={suggestion.accept} small onPress={suggestion.apply} style={{ flexGrow: 1 }} />
        </View>
      </Card>
    </FadeIn>
  );
}

/** In the first week of a month, offers last month's review (and in January, last year's). */
export function ReviewPrompt({ today, hasHistory }: { today: DateKey; hasHistory: boolean }) {
  const s = useStyles();
  const c = useTheme();
  const day = Number(today.slice(8, 10));
  const { y, m } = lastMonth(today);
  const key = `${y}-${String(m).padStart(2, '0')}`;
  if (!hasHistory || day > 7 || repo.getKv(REVIEW_KEY) === key) return null;
  const yearToo = m === 12;
  return (
    <FadeIn>
      <PressableScale
        onPress={() => {
          repo.setKv(REVIEW_KEY, key);
          router.push({ pathname: '/review', params: yearToo ? { kind: 'year', y: String(y) } : { kind: 'month', y: String(y), m: String(m) } });
        }}
        style={[s.row, s.link]}
      >
        <View style={[s.icon, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="calendar-number-outline" size={22} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{yearToo ? `Your ${y} in review` : `${monthName(m)} in review`}</Text>
          <Text style={s.text}>How last {yearToo ? 'year' : 'month'} went, in one page.</Text>
        </View>
        <PressableScale onPress={() => repo.setKv(REVIEW_KEY, key)} hitSlop={10} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={20} color={c.muted} />
        </PressableScale>
      </PressableScale>
    </FadeIn>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  link: { backgroundColor: c.card, borderRadius: 28, padding: 18, marginBottom: 14 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  badgeNum: { color: '#fff', fontWeight: '900', fontSize: 17 },
  title: { fontSize: 16, fontWeight: '800', color: c.text },
  text: { fontSize: 14, color: c.muted, marginTop: 3, fontWeight: '600', lineHeight: 19 },
}));

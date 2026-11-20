import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { addDays, diffDays, formatTime, monthName, timeFromDate, type DateKey } from '../domain/dates';
import { lastMonth, moveTime, suggestTimings, type TimingSuggestion } from '../domain/insights';
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

/** "You usually take your 8:00 dose around 8:40. Move the reminder?" */
export function TimingCard({ meds, settings, today, version }: { meds: Medication[]; settings: Settings; today: DateKey; version: number }) {
  const s = useStyles();
  const c = useTheme();
  const suggestion = useMemo<TimingSuggestion | null>(() => {
    if (!settings.smartTiming) return null;
    const off = dismissed();
    const list = suggestTimings(meds, repo.getLogs(addDays(today, -22), today), today);
    return list.find((x) => !off[x.time] || diffDays(off[x.time], today) >= 30) ?? null;
  }, [meds, settings.smartTiming, today, version]);
  if (!suggestion) return null;
  const { time, suggested, typicalOffset } = suggestion;
  const names = suggestion.medIds.map((id) => meds.find((m) => m.id === id)?.name).filter(Boolean);
  const routine = settings.routines.find((r) => r.time === time);

  const accept = async () => {
    for (const id of suggestion.medIds) {
      const m = repo.getMed(id);
      const moved = m ? moveTime(m, time, suggested) : null;
      if (m && moved) repo.saveMedRetimed(m, moved, today);
    }
    if (routine) repo.saveSettings({ ...repo.getSettings(), routines: settings.routines.map((r) => (r.id === routine.id ? { ...r, time: suggested } : r)) });
    await rescheduleAll().catch(() => {});
  };
  const later = () => repo.setKv(TIMING_KEY, JSON.stringify({ ...dismissed(), [time]: today }));

  return (
    <FadeIn>
      <Card>
        <View style={s.row}>
          <View style={[s.icon, { backgroundColor: c.primarySoft }]}>
            <Ionicons name="time-outline" size={22} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Move your {routine ? routine.name : formatTime(time)} reminder?</Text>
            <Text style={s.text}>
              Over the last 3 weeks you usually took {names.length === 1 ? names[0] : 'these doses'} about {Math.abs(typicalOffset)} min{' '}
              {typicalOffset > 0 ? 'after' : 'before'} the reminder. Moving it to {formatTime(suggested)} would match your day.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <Button title="Not now" kind="secondary" small onPress={later} style={{ flexGrow: 1 }} />
          <Button title={`Move to ${formatTime(suggested)}`} small onPress={accept} style={{ flexGrow: 1 }} />
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

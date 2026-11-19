import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { logAsNeeded, logDose } from '../../actions';
import { Confetti } from '../../components/Confetti';
import { DoseRow } from '../../components/DoseRow';
import { Screen } from '../../components/Screen';
import { Button, Card, FadeIn, PressableScale, Ring, Rings, SectionTitle, Text } from '../../components/ui';
import { addDays, diffDays, formatDateLong, formatTime, parseDateKey, timeFromDate, weekdayOf } from '../../domain/dates';
import { describeDose } from '../../domain/dose';
import { adherence, isGoldDay } from '../../domain/progress';
import { routineAt } from '../../domain/routines';
import { EarnBackCard, FoodTimerCard, MilestoneCard, ReviewPrompt, TimingCard } from '../../components/TodayCards';
import { dosesOn, dueAt, groupByTime, indexLogs, punctuality } from '../../domain/schedule';
import * as repo from '../../db/repo';
import { useDbVersion, useMeds, useProgress, useSettings } from '../../hooks/useData';
import { getPermissionState, requestExactAlarms, requestNotificationPermission, type PermissionState } from '../../notifications/permissions';
import { rescheduleAll } from '../../notifications/reminders';
import { MedIcon } from '../../components/MedIcon';
import { NoteCard } from '../../components/NoteCard';
import { CareCard } from '../../components/CareCard';
import { useFollowing } from '../../hooks/useFollowing';
import { makeStyles, useTheme } from '../../theme';

export default function TodayScreen() {
  const c = useTheme();
  const s = useStyles();
  const meds = useMeds();
  const settings = useSettings();
  const people = useFollowing();
  const version = useDbVersion();
  const { today, progress, byDate, summaries } = useProgress();
  const summariesCount = summaries.length;
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const refreshPerm = useCallback(() => {
    getPermissionState().then(setPerm).catch(() => {});
  }, []);
  useEffect(refreshPerm, [refreshPerm, today]);

  const medById = useMemo(() => new Map(meds.map((m) => [m.id, m])), [meds]);
  const doses = useMemo(() => dosesOn(meds, today), [meds, today]);
  const todayLogs = useMemo(() => repo.getLogs(today, today), [today, version]);
  const logs = useMemo(() => indexLogs(todayLogs), [todayLogs]);
  const groups = groupByTime(doses);
  const asNeeded = meds.filter((m) => !m.archived && m.schedule.pattern.kind === 'asNeeded');
  const answered = doses.filter((d) => logs.has(d.slot)).length;
  const taken = doses.filter((d) => logs.get(d.slot)?.status === 'taken');
  const onTime = taken.filter((d) => punctuality(d, new Date(logs.get(d.slot)!.at), settings.onTimeWindowMinutes) === 'onTime').length;
  const now = new Date();
  const allDone = doses.length > 0 && answered === doses.length;
  const goldToday = allDone && taken.length > 0 && onTime === taken.length;

  // This week, Monday first.
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekPct = adherence(week.filter((d) => diffDays(d, today) >= 0).map((d) => byDate.get(d)).filter((x) => !!x));

  // Confetti when the last dose of the day is answered while the app is open.
  const wasDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasDone.current && settings.celebrate) setCelebrate(true);
    wasDone.current = allDone;
  }, [allDone, settings.celebrate]);

  const enableReminders = async () => {
    await requestNotificationPermission();
    await requestExactAlarms();
    refreshPerm();
    rescheduleAll().catch(() => {});
  };

  const activeCount = meds.filter((m) => !m.archived).length;

  // One at a time, so each dose is logged before the reminders are worked out again.
  const takeAll = async (pending: typeof doses) => {
    let failed = 0;
    for (const d of pending) await logDose(d, 'taken').catch(() => failed++);
    if (failed) Alert.alert('Some doses were not saved', 'Please try again.');
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Today" subtitle={formatDateLong(today)}>
        {perm && (!perm.notifications || !perm.exactAlarms) ? (
          <FadeIn>
            <Card style={{ backgroundColor: c.warnSoft }}>
              <Text style={s.bannerTitle}>{!perm.notifications ? 'Reminders are off' : 'Reminders may arrive late'}</Text>
              <Text style={s.bannerText}>
                {!perm.notifications
                  ? 'Allow notifications so the app can remind you when a dose is due.'
                  : 'Allow "Alarms & reminders" so doses ring on time, even when battery saving is on.'}
              </Text>
              <Button title="Turn on" onPress={enableReminders} style={{ marginTop: 12, alignSelf: 'flex-start' }} small />
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn>
          <View style={[s.hero, { backgroundColor: c.hero }]}>
            <View style={s.heroTop}>
              <Rings
                size={148}
                stroke={14}
                track="rgba(255,255,255,0.18)"
                rings={[
                  { value: answered, total: doses.length, color: c.rings[0] },
                  { value: onTime, total: taken.length, color: c.rings[1] },
                  { value: weekPct ?? 0, total: weekPct == null ? 0 : 1, color: c.rings[2] },
                ]}
              >
                <Text style={s.ringBig}>
                  {answered}
                  <Text style={s.ringOf}>/{doses.length}</Text>
                </Text>
              </Rings>
              <View style={{ flex: 1, gap: 12 }}>
                <Legend color={c.rings[0]} label="Doses today" value={doses.length ? `${answered} of ${doses.length}` : 'None due'} />
                <Legend color={c.rings[1]} label="On time" value={taken.length ? `${onTime} of ${taken.length}` : '–'} />
                <Legend color={c.rings[2]} label="This week" value={weekPct == null ? '–' : `${Math.round(weekPct * 100)}%`} />
              </View>
            </View>
            <View style={s.heroPills}>
              <View style={s.pill}>
                <Ionicons name="flame" size={14} color="#fff" />
                <Text style={s.pillText}>{progress.currentStreak} day streak</Text>
              </View>
              <View style={s.pill}>
                <Ionicons name="snow-outline" size={14} color="#fff" />
                <Text style={s.pillText}>{progress.freezes} {progress.freezes === 1 ? 'freeze' : 'freezes'}</Text>
              </View>
              {goldToday ? (
                <View style={[s.pill, { backgroundColor: c.warn }]}>
                  <Ionicons name="star" size={14} color="#fff" />
                  <Text style={s.pillText}>All on time</Text>
                </View>
              ) : null}
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={80}>
          <Card style={s.week}>
            {week.map((d) => {
              const sum = byDate.get(d);
              const future = diffDays(today, d) > 0;
              const isToday = d === today;
              const done = sum ? sum.taken + sum.skipped : 0;
              return (
                <PressableScale key={d} onPress={() => router.push('/calendar')} style={s.weekDay}>
                  <Text style={[s.weekLetter, isToday && { color: c.primary }]}>{'MTWTFSS'[(weekdayOf(d) + 6) % 7]}</Text>
                  <Ring
                    value={future ? 0 : done}
                    total={future ? 0 : (sum?.scheduled ?? 0)}
                    size={34}
                    stroke={5}
                    color={isGoldDay(sum) ? c.warn : sum?.status === 'complete' ? c.good : sum?.status === 'missed' ? c.bad : c.primary}
                  >
                    {isGoldDay(sum) ? (
                      <Ionicons name="star" size={13} color={c.warn} />
                    ) : sum?.status === 'complete' ? (
                      <Ionicons name="checkmark" size={14} color={c.good} />
                    ) : null}
                  </Ring>
                  <Text style={[s.weekNum, isToday && { color: c.primary, fontWeight: '900' }]}>{parseDateKey(d).d}</Text>
                </PressableScale>
              );
            })}
          </Card>
        </FadeIn>

        <MilestoneCard progress={progress} />
        <EarnBackCard progress={progress} />
        <FoodTimerCard key={version} />

        {allDone ? (
          <FadeIn>
            <Card style={[s.done, { backgroundColor: goldToday ? c.warnSoft : c.goodSoft }]}>
              <Ionicons name={goldToday ? 'star' : 'checkmark-circle'} size={30} color={goldToday ? c.warn : c.good} />
              <View style={{ flex: 1 }}>
                <Text style={[s.bannerTitle, { color: goldToday ? c.warn : c.good }]}>{goldToday ? 'A gold day' : 'All done for today'}</Text>
                <Text style={s.bannerText}>{goldToday ? 'Every dose taken, and every one on time.' : 'Every dose is logged.'}</Text>
              </View>
            </Card>
          </FadeIn>
        ) : null}

        <TimingCard meds={meds} settings={settings} today={today} version={version} />
        <ReviewPrompt today={today} hasHistory={summariesCount > 20} />

        {activeCount === 0 ? (
          <FadeIn delay={120}>
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Ionicons name="medkit-outline" size={40} color={c.muted} />
              <Text style={s.emptyTitle}>Add your first medication</Text>
              <Text style={[s.bannerText, { textAlign: 'center' }]}>Set its schedule once and the app reminds you every time it's due.</Text>
              <Button title="Add medication" onPress={() => router.push('/med/new')} style={{ marginTop: 16 }} />
            </Card>
          </FadeIn>
        ) : null}

        {groups.map((g, i) => {
          const pending = g.doses.filter((d) => !logs.has(d.slot));
          const overdue = pending.length > 0 && dueAt(today, g.time) < now;
          return (
            <FadeIn key={g.time} delay={120 + i * 50}>
              <SectionTitle
                right={
                  pending.length === 0 ? (
                    <Text style={[s.tag, { color: c.good, backgroundColor: c.goodSoft }]}>Done</Text>
                  ) : overdue ? (
                    <Text style={[s.tag, { color: c.bad, backgroundColor: c.badSoft }]}>Due now</Text>
                  ) : null
                }
              >
                {routineAt(g.time, settings.routines) ? `${routineAt(g.time, settings.routines)!.name} · ${formatTime(g.time)}` : formatTime(g.time)}
              </SectionTitle>
              <Card style={{ paddingVertical: 6 }}>
                {g.doses.map((d) => {
                  const med = medById.get(d.medId);
                  return med ? <DoseRow key={d.slot} dose={d} med={med} log={logs.get(d.slot)} windowMinutes={settings.onTimeWindowMinutes} /> : null;
                })}
                {pending.length > 1 ? (
                  <Button title={`Take all ${pending.length}`} kind="secondary" small onPress={() => takeAll(pending)} style={{ marginTop: 6, marginBottom: 6 }} />
                ) : null}
              </Card>
            </FadeIn>
          );
        })}

        {asNeeded.length > 0 ? (
          <>
            <SectionTitle>As needed</SectionTitle>
            <Card style={{ paddingVertical: 6 }}>
              {asNeeded.map((m) => {
                const last = todayLogs.filter((l) => l.medId === m.id).sort((a, b) => b.at.localeCompare(a.at))[0];
                return (
                  <View key={m.id} style={s.prnRow}>
                    <MedIcon med={m} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.prnName}>{m.name}</Text>
                      <Text style={s.prnSub}>{last ? `Last today at ${formatTime(timeFromDate(new Date(last.at)))}` : describeDose(m)}</Text>
                    </View>
                    <Button title="Log" small kind="secondary" onPress={() => logAsNeeded(m)} />
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}

        {activeCount > 0 ? (
          <View style={{ marginTop: 14 }}>
            <NoteCard date={today} />
          </View>
        ) : null}

        {people.length > 0 ? (
          <>
            <SectionTitle>People I look after</SectionTitle>
            {people.map((p) => (
              <PressableScale key={p.code.id} onPress={() => router.push('/care')} style={{ marginBottom: 10 }}>
                <CareCard person={p} graceMinutes={settings.care.graceMinutes} />
              </PressableScale>
            ))}
          </>
        ) : null}
      </Screen>
      {celebrate ? <Confetti onDone={() => setCelebrate(false)} /> : null}
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <View>
        <Text style={s.legendLabel}>{label}</Text>
        <Text style={s.legendValue}>{value}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { borderRadius: 32, padding: 20, marginBottom: 14, shadowColor: c.hero, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringBig: { fontSize: 30, fontWeight: '900', color: '#fff' },
  ringOf: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  legendLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  legendValue: { fontSize: 17, fontWeight: '900', color: '#fff' },
  heroPills: { flexDirection: 'row', gap: 8, marginTop: 16 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  week: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12 },
  weekDay: { alignItems: 'center', gap: 6 },
  weekLetter: { fontSize: 12, fontWeight: '800', color: c.muted },
  weekNum: { fontSize: 12, fontWeight: '700', color: c.muted },
  done: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tag: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: c.text },
  bannerText: { fontSize: 14, color: c.muted, marginTop: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: c.text, marginTop: 8 },
  prnRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  prnName: { fontSize: 17, fontWeight: '800', color: c.text },
  prnSub: { fontSize: 14, color: c.muted, marginTop: 1, fontWeight: '600' },
}));

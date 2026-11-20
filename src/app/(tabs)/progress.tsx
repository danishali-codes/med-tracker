import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Line, Polyline } from 'react-native-svg';
import { Screen } from '../../components/Screen';
import { HeatLegend, MonthHeatmap, YearHeatmap } from '../../components/Heatmap';
import { Card, FadeIn, PressableScale, SectionTitle, Text } from '../../components/ui';
import { addDays, parseDateKey, weekdayOf } from '../../domain/dates';
import { adherence, consistency, consistencySeries, FREEZE_EVERY, MAX_FREEZES, nextMilestone } from '../../domain/progress';
import { lastMonth } from '../../domain/insights';
import { monthName } from '../../domain/dates';
import { useProgress } from '../../hooks/useData';
import { makeStyles, useTheme } from '../../theme';

export default function ProgressScreen() {
  const c = useTheme();
  const s = useStyles();
  const { today, progress, badges: allBadges, byDate, summaries } = useProgress();
  // Hidden badges stay a surprise: not listed or counted until they're earned.
  const badges = allBadges.filter((b) => !b.hidden || b.has);
  const last30 = summaries.slice(-31, -1);
  const pct30 = adherence(last30);
  const onTimePct = progress.totalTaken ? Math.round((progress.totalOnTime / progress.totalTaken) * 100) : null;
  const toNextFreeze = progress.freezes >= MAX_FREEZES ? null : FREEZE_EVERY - (progress.currentStreak % FREEZE_EVERY);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const earned = badges.filter((b) => b.has).length;
  const [range, setRange] = useState<'weeks' | 'month' | 'year'>('weeks');
  const next = nextMilestone(progress.currentStreak);
  const score = Math.round(consistency(summaries) * 100);
  const series = consistencySeries(summaries).slice(-60);
  const monthAgo = series.length > 30 ? Math.round(series[series.length - 31].score * 100) : null;
  const lm = lastMonth(today);
  const thisYear = Number(today.slice(0, 4));

  return (
    <Screen title="Progress" subtitle="Keep it going">
      <FadeIn>
        <View style={[s.streak, { backgroundColor: c.flame }]}>
          <Flame />
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 150 }}>
            <Text style={s.streakBig}>{progress.currentStreak}</Text>
            <Text style={s.streakLabel}>day streak</Text>
            <Text style={s.streakSub}>Best: {progress.bestStreak} days</Text>
            {next ? <Text style={s.streakSub}>Next milestone: {next} days</Text> : null}
          </View>
          <View style={s.freezeBox}>
            <Ionicons name="snow-outline" size={24} color="#fff" />
            <Text style={s.freezeText}>
              {progress.freezes} {progress.freezes === 1 ? 'freeze' : 'freezes'}
            </Text>
            {toNextFreeze != null ? <Text style={s.freezeSub}>next in {toNextFreeze}d</Text> : null}
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={30}>
        <Card style={s.scoreCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.scoreLabel}>Consistency</Text>
            <Text style={s.scoreBig}>{score}</Text>
            <Text style={s.hintTight}>
              {monthAgo == null ? 'Builds up over the first few weeks.' : score >= monthAgo ? `Up ${score - monthAgo} from a month ago.` : `Down ${monthAgo - score} from a month ago.`}
            </Text>
          </View>
          <Spark values={series.map((p) => p.score)} color={c.primary} />
        </Card>
        <Text style={[s.hint, { marginTop: 0, marginBottom: 12, marginHorizontal: 6 }]}>
          A score out of 100 that rises with every day you take your doses and drops a little on a missed day, so one bad day never wipes out a good month.
        </Text>
      </FadeIn>

      <FadeIn delay={45} style={s.grid}>
        <Stat icon="star" value={`${progress.perfectStreak}`} label="Perfect streak" color={c.warn} />
        <Stat icon="ribbon-outline" value={`${progress.bestPerfectStreak}`} label="Best perfect streak" color={c.warn} />
      </FadeIn>
      <Text style={[s.hint, { marginTop: 0, marginBottom: 12, marginHorizontal: 6 }]}>
        The perfect streak counts days in a row with every dose done and no freeze or win-back used.
      </Text>

      <FadeIn delay={60} style={s.grid}>
        <Stat icon="pie-chart-outline" value={pct30 == null ? '–' : `${Math.round(pct30 * 100)}%`} label="Last 30 days" color={c.primary} />
        <Stat icon="time-outline" value={onTimePct == null ? '–' : `${onTimePct}%`} label="On time" color={c.good} />
        <Stat icon="star-outline" value={`${progress.perfectDays}`} label="Perfect days" color={c.warn} />
        <Stat icon="checkmark-done" value={`${progress.totalTaken}`} label="Doses taken" color={c.ice} />
      </FadeIn>

      <FadeIn delay={90}>
        <PressableScale onPress={() => router.push('/report')} style={s.reportLink}>
          <Ionicons name="document-text-outline" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.reportTitle}>Doctor report</Text>
            <Text style={[s.hint, { marginTop: 2 }]}>A PDF of doses, missed days and symptoms for any period</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.faint} />
        </PressableScale>
      </FadeIn>

      <FadeIn delay={100}>
        <SectionTitle>Look back</SectionTitle>
        <PressableScale onPress={() => router.push({ pathname: '/review', params: { kind: 'month', y: today.slice(0, 4), m: String(Number(today.slice(5, 7))) } })} style={s.reportLink}>
          <Ionicons name="calendar-outline" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.reportTitle}>{monthName(Number(today.slice(5, 7)))} so far</Text>
            <Text style={[s.hint, { marginTop: 2 }]}>
              Or{' '}
              <Text
                style={{ color: c.primary, fontWeight: '800' }}
                onPress={() => router.push({ pathname: '/review', params: { kind: 'month', y: String(lm.y), m: String(lm.m) } })}
              >
                {monthName(lm.m)} in review
              </Text>
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.faint} />
        </PressableScale>
        <PressableScale onPress={() => router.push({ pathname: '/review', params: { kind: 'year', y: String(thisYear) } })} style={s.reportLink}>
          <Ionicons name="albums-outline" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.reportTitle}>{thisYear} in review</Text>
            <Text style={[s.hint, { marginTop: 2 }]}>Your year so far, month by month</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.faint} />
        </PressableScale>
        <PressableScale onPress={() => router.push('/mood')} style={s.reportLink}>
          <Ionicons name="happy-outline" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.reportTitle}>Mood trend</Text>
            <Text style={[s.hint, { marginTop: 2 }]}>How you've felt over the last month, 3 months or year</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.faint} />
        </PressableScale>
        <PressableScale onPress={() => router.push('/patterns')} style={s.reportLink}>
          <Ionicons name="pulse-outline" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.reportTitle}>Patterns</Text>
            <Text style={[s.hint, { marginTop: 2 }]}>How your mood and symptoms line up with your doses</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.faint} />
        </PressableScale>
      </FadeIn>

      <FadeIn delay={120}>
        <SectionTitle>History</SectionTitle>
        <View style={s.segment}>
          {(
            [
              ['weeks', '2 weeks'],
              ['month', 'Month'],
              ['year', 'Year'],
            ] as const
          ).map(([k, label]) => (
            <PressableScale key={k} onPress={() => setRange(k)} haptic style={[s.segItem, range === k && { backgroundColor: c.primary }]}>
              <Text style={[s.segText, range === k && { color: c.onPrimary }]}>{label}</Text>
            </PressableScale>
          ))}
        </View>
        <Card>
          {range === 'weeks' ? (
            <View style={s.chart}>
              {days.map((d, i) => {
                const sum = byDate.get(d);
                const v = sum && sum.scheduled ? (sum.taken + sum.skipped) / sum.scheduled : 0;
                const color = sum?.status === 'complete' ? c.good : sum?.status === 'missed' ? c.bad : sum?.status === 'partial' ? c.warn : c.primary;
                return <Bar key={d} value={v} color={color} delay={i * 30} label={'MTWTFSS'[(weekdayOf(d) + 6) % 7]} sub={parseDateKey(d).d} highlight={d === today} />;
              })}
            </View>
          ) : range === 'month' ? (
            <MonthHeatmap byDate={byDate} frozen={progress.frozenDays} today={today} />
          ) : (
            <YearHeatmap byDate={byDate} frozen={progress.frozenDays} today={today} />
          )}
          {range !== 'weeks' ? <HeatLegend /> : null}
          <Text style={s.hint}>
            Taking a dose late still counts. Only a dose missed all day breaks the streak, and a freeze covers one missed day. With no freeze left, taking
            every dose for the next 3 days wins the streak back.
          </Text>
        </Card>
      </FadeIn>

      <FadeIn delay={180}>
        <SectionTitle right={<Text style={s.count}>{earned}/{badges.length}</Text>}>Badges</SectionTitle>
        <View style={s.badges}>
          {badges.map((b) => (
            <View key={b.id} style={[s.badge, !b.has && { opacity: 0.45 }]}>
              <View style={[s.badgeIcon, { backgroundColor: b.has ? c.primarySoft : c.sunken }]}>
                <Ionicons name={(b.has ? b.icon : 'lock-closed-outline') as keyof typeof Ionicons.glyphMap} size={26} color={b.has ? c.primary : c.faint} />
              </View>
              <Text style={s.badgeName} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={s.badgeDesc} numberOfLines={2}>
                {b.description}
              </Text>
            </View>
          ))}
        </View>
      </FadeIn>
    </Screen>
  );
}

/** A small line of the consistency score over the last two months. */
function Spark({ values, color }: { values: number[]; color: string }) {
  const c = useTheme();
  const w = 120,
    h = 54;
  if (values.length < 2) return null;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - v * h).toFixed(1)}`).join(' ');
  return (
    <Svg width={w} height={h}>
      <Line x1={0} y1={h - 0.5} x2={w} y2={h - 0.5} stroke={c.border} strokeWidth={1} />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function Flame() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
      <Ionicons name="flame" size={56} color="#fff" />
    </Animated.View>
  );
}

function Stat({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; color: string }) {
  const c = useTheme();
  const s = useStyles();
  return (
    <Card style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: color + (c.dark ? '2E' : '1C') }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.statValue, { color: c.text }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Card>
  );
}

function Bar({ value, color, delay, label, sub, highlight }: { value: number; color: string; delay: number; label: string; sub: number; highlight: boolean }) {
  const c = useTheme();
  const s = useStyles();
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(h, { toValue: value, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [h, value, delay]);
  return (
    <View style={s.barCol}>
      <View style={s.barTrack}>
        <Animated.View style={[s.barFill, { backgroundColor: color, height: h.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Text style={[s.barLabel, highlight && { color: c.primary }]}>{label}</Text>
      <Text style={[s.barSub, highlight && { color: c.primary }]}>{sub}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreLabel: { fontSize: 11, color: c.muted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  scoreBig: { fontSize: 40, fontWeight: '900', color: c.text, lineHeight: 46 },
  hintTight: { fontSize: 12, color: c.muted, fontWeight: '600' },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 28, padding: 18, marginBottom: 14 },
  reportTitle: { fontSize: 16, fontWeight: '800', color: c.text },
  streak: { borderRadius: 32, padding: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 14 },
  streakBig: { fontSize: 48, fontWeight: '900', color: '#fff', lineHeight: 52 },
  streakLabel: { fontSize: 16, fontWeight: '800', color: '#fff' },
  streakSub: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  freezeBox: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 22, padding: 12, minWidth: 84 },
  freezeText: { color: '#fff', fontWeight: '900', fontSize: 13, marginTop: 2 },
  freezeSub: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stat: { width: '48%', alignItems: 'flex-start', paddingVertical: 18 },
  statValue: { fontSize: 30, fontWeight: '900' },
  statLabel: { fontSize: 11, color: c.muted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  segment: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 18, padding: 4, marginBottom: 12 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14 },
  segText: { fontSize: 14, fontWeight: '800', color: c.muted },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8 },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: { width: 12, height: 100, borderRadius: 6, backgroundColor: c.sunken, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 10, fontWeight: '800', color: c.muted, marginTop: 6 },
  barSub: { fontSize: 10, fontWeight: '600', color: c.faint },
  hint: { fontSize: 12, color: c.muted, marginTop: 12 },
  count: { fontSize: 14, fontWeight: '800', color: c.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badge: {
    width: '31.5%',
    backgroundColor: c.card,
    borderRadius: 22,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: c.dark ? 1 : 0,
    borderColor: c.border,
  },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  badgeName: { fontSize: 12, fontWeight: '900', color: c.text, textAlign: 'center' },
  badgeDesc: { fontSize: 10, color: c.muted, textAlign: 'center', marginTop: 2, fontWeight: '600' },
}));

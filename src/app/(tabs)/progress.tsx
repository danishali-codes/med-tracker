import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { HeatLegend, MonthHeatmap, YearHeatmap } from '../../components/Heatmap';
import { Card, FadeIn, PressableScale, SectionTitle, Text } from '../../components/ui';
import { addDays, parseDateKey, weekdayOf } from '../../domain/dates';
import { adherence, FREEZE_EVERY, MAX_FREEZES } from '../../domain/progress';
import { useProgress } from '../../hooks/useData';
import { makeStyles, useTheme } from '../../theme';

export default function ProgressScreen() {
  const c = useTheme();
  const s = useStyles();
  const { today, progress, badges, byDate, summaries } = useProgress();
  const last30 = summaries.slice(-31, -1);
  const pct30 = adherence(last30);
  const onTimePct = progress.totalTaken ? Math.round((progress.totalOnTime / progress.totalTaken) * 100) : null;
  const toNextFreeze = progress.freezes >= MAX_FREEZES ? null : FREEZE_EVERY - (progress.currentStreak % FREEZE_EVERY);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const earned = badges.filter((b) => b.has).length;
  const [range, setRange] = useState<'weeks' | 'month' | 'year'>('weeks');

  return (
    <Screen title="Progress" subtitle="Keep it going">
      <FadeIn>
        <LinearGradient colors={[c.flame, '#FF4F7B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.streak}>
          <Flame />
          <View style={{ flex: 1 }}>
            <Text style={s.streakBig}>{progress.currentStreak}</Text>
            <Text style={s.streakLabel}>day streak</Text>
            <Text style={s.streakSub}>Best: {progress.bestStreak} days</Text>
          </View>
          <View style={s.freezeBox}>
            <Text style={{ fontSize: 24 }}>{'❄️'.repeat(Math.max(1, progress.freezes))}</Text>
            <Text style={s.freezeText}>
              {progress.freezes} {progress.freezes === 1 ? 'freeze' : 'freezes'}
            </Text>
            {toNextFreeze != null ? <Text style={s.freezeSub}>next in {toNextFreeze}d</Text> : null}
          </View>
        </LinearGradient>
      </FadeIn>

      <FadeIn delay={60} style={s.grid}>
        <Stat icon="pie-chart-outline" value={pct30 == null ? '–' : `${Math.round(pct30 * 100)}%`} label="Last 30 days" color={c.primary} />
        <Stat icon="time-outline" value={onTimePct == null ? '–' : `${onTimePct}%`} label="On time" color={c.good} />
        <Stat icon="star-outline" value={`${progress.perfectDays}`} label="Perfect days" color={c.warn} />
        <Stat icon="checkmark-done" value={`${progress.totalTaken}`} label="Doses taken" color={c.ice} />
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
          <Text style={s.hint}>Taking a dose late still counts. Only a dose missed all day breaks the streak, and a freeze covers one missed day.</Text>
        </Card>
      </FadeIn>

      <FadeIn delay={180}>
        <SectionTitle right={<Text style={s.count}>{earned}/{badges.length}</Text>}>Badges</SectionTitle>
        <View style={s.badges}>
          {badges.map((b) => (
            <View key={b.id} style={[s.badge, !b.has && { opacity: 0.45 }]}>
              <View style={[s.badgeIcon, { backgroundColor: b.has ? c.primarySoft : c.sunken }]}>
                <Text style={{ fontSize: 28 }}>{b.has ? b.emoji : '🔒'}</Text>
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
    <Animated.Text style={{ fontSize: 64, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) }] }}>
      🔥
    </Animated.Text>
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
  streak: { borderRadius: 32, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
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
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 14 },
  segText: { fontSize: 14, fontWeight: '800', color: c.muted },
  chart: { flexDirection: 'row', justifyContent: 'space-between', height: 150, alignItems: 'flex-end' },
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

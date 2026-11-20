import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { PageScroll } from '../components/Screen';
import { Card, FadeIn, PressableScale, SectionTitle, Text } from '../components/ui';
import { eachDay } from '../domain/dates';
import { buildReview, monthRange } from '../domain/insights';
import { dosesOn, indexLogs } from '../domain/schedule';
import { MOODS } from '../domain/types';
import * as repo from '../db/repo';
import { useMeds, useProgress } from '../hooks/useData';
import { makeStyles, useTheme } from '../theme';

const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`);

/** One page on how a month or a year went. Built on the phone from your own history. */
export default function ReviewScreen() {
  const c = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ kind?: string; y?: string; m?: string }>();
  const kind = params.kind === 'year' ? 'year' : 'month';
  const y = Number(params.y) || new Date().getFullYear();
  const m = Number(params.m) || new Date().getMonth() + 1;
  const meds = useMeds();
  const { summaries, progress, today } = useProgress();

  const review = useMemo(() => {
    const range = kind === 'month' ? monthRange(y, m) : { from: `${y}-01-01`, to: `${y}-12-31` };
    const to = range.to < today ? range.to : today;
    const logs = indexLogs(repo.getLogs(range.from, to));
    const dueDoses = range.from <= to ? eachDay(range.from, to).flatMap((d) => (d < today ? dosesOn(meds, d) : [])) : [];
    return buildReview({
      kind,
      y,
      m,
      summaries,
      frozenDays: progress.frozenDays,
      notes: repo.getNotes(range.from, to),
      logs,
      dueDoses,
      today,
    });
  }, [kind, y, m, meds, summaries, progress.frozenDays, today]);

  const go = (delta: number) => {
    if (kind === 'year') router.setParams({ y: String(y + delta) });
    else {
      const m0 = m - 1 + delta;
      router.setParams({ y: String(y + Math.floor(m0 / 12)), m: String((((m0 % 12) + 12) % 12) + 1) });
    }
  };
  const nextIsFuture = kind === 'year' ? y + 1 > Number(today.slice(0, 4)) : `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01` > today;
  const ongoing = review.to >= today || (kind === 'month' ? monthRange(y, m).to >= today : `${y}-12-31` >= today);
  const empty = review.scheduled === 0;
  const delta = Math.round((review.consistencyEnd - review.consistencyStart) * 100);

  return (
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: kind === 'year' ? 'Year in review' : 'Month in review' }} />
      <View style={s.header}>
        <PressableScale onPress={() => go(-1)} hitSlop={12} style={s.arrow} accessibilityLabel="Earlier">
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </PressableScale>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.title}>{review.title}</Text>
          {ongoing ? <Text style={s.sub}>So far</Text> : null}
        </View>
        <PressableScale onPress={() => !nextIsFuture && go(1)} hitSlop={12} style={[s.arrow, nextIsFuture && { opacity: 0.3 }]} accessibilityLabel="Later">
          <Ionicons name="chevron-forward" size={20} color={c.text} />
        </PressableScale>
      </View>

      {empty ? (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Ionicons name="calendar-clear-outline" size={36} color={c.muted} />
          <Text style={[s.body, { textAlign: 'center', marginTop: 8 }]}>No doses were due in this {kind}.</Text>
        </Card>
      ) : (
        <>
          <FadeIn>
            <Card style={{ backgroundColor: c.primary }}>
              <Text style={[s.heroBig, { color: c.onPrimary }]}>{pct(review.takenPct)}</Text>
              <Text style={[s.heroText, { color: c.onPrimary }]}>
                of doses taken: {review.taken} of {review.scheduled - review.skipped}
                {review.skipped ? `, plus ${review.skipped} skipped on purpose` : ''}.
              </Text>
            </Card>
          </FadeIn>

          <FadeIn delay={40} style={s.grid}>
            <Tile value={`${review.perfectDays}`} label="Full days" />
            <Tile value={`${review.goldDays}`} label="Gold days" hint="All on time" />
            <Tile value={`${review.longestRun}`} label="Longest run" hint="days" />
            <Tile value={pct(review.onTimePct)} label="On time" />
            <Tile value={`${review.missedDays}`} label="Days with a miss" />
            <Tile value={`${review.freezesUsed}`} label="Freezes used" />
          </FadeIn>

          <SectionTitle>{kind === 'year' ? 'Month by month' : 'Week by week'}</SectionTitle>
          <Card>
            <View style={s.bars}>
              {review.parts.map((p, i) => (
                <View key={i} style={s.barCol}>
                  <Text style={s.barValue}>{p.pct == null ? '' : Math.round(p.pct * 100)}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { height: `${Math.round((p.pct ?? 0) * 100)}%`, backgroundColor: (p.pct ?? 0) >= 0.95 ? c.good : (p.pct ?? 0) >= 0.8 ? c.primary : c.warn }]} />
                  </View>
                  <Text style={s.barLabel}>{p.label}</Text>
                </View>
              ))}
            </View>
            <Text style={s.small}>Share of doses taken{kind === 'year' ? ' each month' : ' each week (by day of the month)'}.</Text>
          </Card>

          <SectionTitle>Highlights</SectionTitle>
          <Card>
            <Line icon="trending-up-outline" text={`Consistency went from ${Math.round(review.consistencyStart * 100)} to ${Math.round(review.consistencyEnd * 100)}${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}.`} />
            {review.hardestTime ? (
              <Line icon="time-outline" text={`Most misses came in the ${review.hardestTime.label.toLowerCase()}: ${review.hardestTime.missed} ${review.hardestTime.missed === 1 ? 'dose' : 'doses'}.`} />
            ) : (
              <Line icon="checkmark-done-outline" text="No dose was left untaken." />
            )}
            {review.moodAverage != null ? (
              <Line icon="happy-outline" text={`Average mood: ${MOODS[Math.max(0, Math.min(4, Math.round(review.moodAverage) - 1))].label.toLowerCase()} (${review.moodAverage.toFixed(1)} of 5, from ${review.moodDays} ${review.moodDays === 1 ? 'note' : 'notes'}).`} />
            ) : null}
            {review.topSymptoms.length ? (
              <Line icon="list-outline" text={`Noted most: ${review.topSymptoms.map((x) => `${x.name.toLowerCase()} (${x.days} ${x.days === 1 ? 'day' : 'days'})`).join(', ')}.`} />
            ) : null}
          </Card>
        </>
      )}
    </PageScroll>
  );
}

function Tile({ value, label, hint }: { value: string; label: string; hint?: string }) {
  const s = useStyles();
  return (
    <Card style={s.tile}>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      {hint ? <Text style={s.small}>{hint}</Text> : null}
    </Card>
  );
}

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const c = useTheme();
  const s = useStyles();
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={20} color={c.primary} style={{ marginTop: 1 }} />
      <Text style={[s.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  arrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: c.text },
  sub: { fontSize: 13, fontWeight: '700', color: c.muted },
  heroBig: { fontSize: 46, fontWeight: '900', lineHeight: 52 },
  heroText: { fontSize: 15, fontWeight: '700', opacity: 0.9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  tile: { width: '31.5%', paddingVertical: 14, paddingHorizontal: 10, alignItems: 'flex-start' },
  tileValue: { fontSize: 24, fontWeight: '900', color: c.text },
  tileLabel: { fontSize: 11, color: c.muted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  small: { fontSize: 11, color: c.muted, fontWeight: '600', marginTop: 4 },
  body: { fontSize: 15, color: c.text, fontWeight: '600', lineHeight: 21 },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8 },
  barCol: { alignItems: 'center', flex: 1 },
  barValue: { fontSize: 10, color: c.muted, fontWeight: '700', marginBottom: 4 },
  barTrack: { width: 14, height: 96, borderRadius: 7, backgroundColor: c.sunken, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 7 },
  barLabel: { fontSize: 11, fontWeight: '800', color: c.muted, marginTop: 6 },
}));

import { useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { DoseRow } from '../../components/DoseRow';
import { Screen } from '../../components/Screen';
import { Card, FadeIn, PressableScale, SectionTitle, Text } from '../../components/ui';
import { daysInMonth, diffDays, formatDateLong, formatTime, monthName, parseDateKey, weekdayOf, type DateKey } from '../../domain/dates';
import type { DaySummary } from '../../domain/progress';
import { dosesOn, indexLogs } from '../../domain/schedule';
import * as repo from '../../db/repo';
import { useDbVersion, useMeds, useProgress, useSettings } from '../../hooks/useData';
import { makeStyles, useTheme } from '../../theme';

const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarScreen() {
  const c = useTheme();
  const st = useStyles();
  const { today, byDate, progress } = useProgress();
  const meds = useMeds();
  const settings = useSettings();
  const version = useDbVersion();
  const t = parseDateKey(today);
  const [month, setMonth] = useState({ y: t.y, m: t.m });
  const [selected, setSelected] = useState<DateKey>(today);

  const cells = useMemo(() => {
    const first = `${month.y}-${pad(month.m)}-01`;
    const lead = (weekdayOf(first) + 6) % 7; // weeks start on Monday
    const n = daysInMonth(month.y, month.m);
    const out: (DateKey | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= n; d++) out.push(`${month.y}-${pad(month.m)}-${pad(d)}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const monthStats = useMemo(() => {
    let scheduled = 0,
      taken = 0,
      perfect = 0;
    for (const key of cells) {
      const s = key ? byDate.get(key) : undefined;
      if (!s || key === today) continue;
      scheduled += s.scheduled - s.skipped;
      taken += s.taken;
      if (s.status === 'complete' && s.scheduled > 0) perfect++;
    }
    return { pct: scheduled ? Math.round((taken / scheduled) * 100) : null, perfect };
  }, [cells, byDate, today]);

  const shift = (delta: number) => {
    const m0 = month.m - 1 + delta;
    setMonth({ y: month.y + Math.floor(m0 / 12), m: (((m0 % 12) + 12) % 12) + 1 });
  };

  const dayLogs = useMemo(() => indexLogs(repo.getLogs(selected, selected)), [selected, version]);
  // What's scheduled now, plus anything logged that day that the current schedule no longer
  // lists (times changed since, or an as-needed dose), so recorded history never disappears.
  const dayDoses = useMemo(() => {
    const scheduled = dosesOn(meds, selected);
    const known = new Set(scheduled.map((d) => d.slot));
    const extra = [...dayLogs.values()]
      .filter((l) => !known.has(l.slot))
      .map((l) => ({ slot: l.slot, medId: l.medId, date: l.date, time: l.time }));
    return [...scheduled, ...extra].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }, [meds, selected, dayLogs]);
  const medById = new Map(meds.map((m) => [m.id, m]));
  const isFuture = diffDays(today, selected) > 0;

  return (
    <Screen title="History" subtitle="Your record">
      <FadeIn>
      <Card>
        <View style={st.header}>
          <PressableScale onPress={() => shift(-1)} hitSlop={12} style={st.arrowBtn} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </PressableScale>
          <Text style={st.month}>
            {monthName(month.m)} {month.y}
          </Text>
          <PressableScale onPress={() => shift(1)} hitSlop={12} style={st.arrowBtn} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </PressableScale>
        </View>
        <View style={st.grid}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text key={i} style={st.weekday}>
              {d}
            </Text>
          ))}
          {cells.map((key, i) => (
            <DayCell
              key={key ?? `x${i}`}
              date={key}
              summary={key ? byDate.get(key) : undefined}
              frozen={!!key && progress.frozenDays.has(key)}
              isToday={key === today}
              selected={key === selected}
              onPress={() => key && setSelected(key)}
            />
          ))}
        </View>
        <View style={st.legend}>
          <Legend color={c.good} label="All taken" />
          <Legend color={c.warn} label="Some missed" />
          <Legend color={c.bad} label="Missed" />
          <Legend color={c.ice} label="Freeze used" />
        </View>
      </Card>
      </FadeIn>

      <FadeIn delay={80} style={st.statsRow}>
        <Card style={st.statCard}>
          <Text style={st.statValue}>{monthStats.pct == null ? '–' : `${monthStats.pct}%`}</Text>
          <Text style={st.statLabel}>doses taken this month</Text>
        </Card>
        <Card style={st.statCard}>
          <Text style={st.statValue}>{monthStats.perfect}</Text>
          <Text style={st.statLabel}>perfect days</Text>
        </Card>
      </FadeIn>

      <SectionTitle>{formatDateLong(selected)}</SectionTitle>
      <Card style={{ paddingVertical: 6 }}>
        {dayDoses.length === 0 ? <Text style={st.empty}>No doses scheduled.</Text> : null}
        {dayDoses.map((d) => {
          const med = medById.get(d.medId);
          if (!med) return null;
          if (isFuture)
            return (
              <View key={d.slot} style={st.futureRow}>
                <Text style={st.futureText}>{med.name}</Text>
                <Text style={st.futureTime}>{formatTime(d.time)}</Text>
              </View>
            );
          return <DoseRow key={d.slot} dose={d} med={med} log={dayLogs.get(d.slot)} windowMinutes={settings.onTimeWindowMinutes} showTime />;
        })}
      </Card>
      {!isFuture && selected !== today && dayDoses.length > 0 ? (
        <Text style={st.hint}>Forgot to log something? Tap the circle to mark it taken, or tap it again to change it.</Text>
      ) : null}
    </Screen>
  );
}

function DayCell({
  date,
  summary,
  frozen,
  isToday,
  selected,
  onPress,
}: {
  date: DateKey | null;
  summary?: DaySummary;
  frozen: boolean;
  isToday: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const st = useStyles();
  if (!date) return <View style={st.cell} />;
  let bg = 'transparent';
  let fg = c.text;
  if (summary) {
    if (frozen) bg = c.ice;
    else if (summary.status === 'complete') bg = c.good;
    else if (summary.status === 'partial') bg = c.warn;
    else if (summary.status === 'missed') bg = c.bad;
    if (bg !== 'transparent') fg = '#fff';
  }
  return (
    <Pressable onPress={onPress} style={st.cell}>
      <View
        style={[
          st.dayBubble,
          { backgroundColor: bg },
          isToday && { borderWidth: 2.5, borderColor: c.primary },
          selected && { transform: [{ scale: 1.12 }], borderWidth: 2.5, borderColor: c.text },
        ]}
      >
        <Text style={[st.dayText, { color: fg }]}>{parseDateKey(date).d}</Text>
      </View>
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10, marginTop: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: c.muted, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  arrowBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 19, fontWeight: '900', color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '800', color: c.muted, marginBottom: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: '82%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  statValue: { fontSize: 30, fontWeight: '900', color: c.primary },
  statLabel: { fontSize: 13, color: c.muted, textAlign: 'center', fontWeight: '600' },
  empty: { color: c.muted, paddingVertical: 12 },
  futureRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  futureText: { fontSize: 16, fontWeight: '700', color: c.text },
  futureTime: { fontSize: 15, color: c.muted, fontWeight: '600' },
  hint: { fontSize: 13, color: c.muted, textAlign: 'center', marginHorizontal: 16 },
}));

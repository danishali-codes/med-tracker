import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DoseRow } from '../../components/DoseRow';
import { Card, SectionTitle } from '../../components/ui';
import { daysInMonth, diffDays, formatDateLong, formatTime, monthName, parseDateKey, weekdayOf, type DateKey } from '../../domain/dates';
import type { DaySummary } from '../../domain/progress';
import { dosesOn, indexLogs } from '../../domain/schedule';
import * as repo from '../../db/repo';
import { useDbVersion, useMeds, useProgress, useSettings } from '../../hooks/useData';
import { colors } from '../../theme';

const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarScreen() {
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

  const dayDoses = useMemo(() => dosesOn(meds, selected), [meds, selected]);
  const dayLogs = useMemo(() => indexLogs(repo.getLogs(selected, selected)), [selected, version]);
  const medById = new Map(meds.map((m) => [m.id, m]));
  const isFuture = diffDays(today, selected) > 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card>
        <View style={st.header}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <Text style={st.arrow}>‹</Text>
          </Pressable>
          <Text style={st.month}>
            {monthName(month.m)} {month.y}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={12}>
            <Text style={st.arrow}>›</Text>
          </Pressable>
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
          <Legend color={colors.good} label="All taken" />
          <Legend color={colors.warn} label="Some missed" />
          <Legend color={colors.bad} label="Missed" />
          <Legend color="#7FB6F0" label="Freeze used" />
        </View>
      </Card>

      <View style={st.statsRow}>
        <Card style={st.statCard}>
          <Text style={st.statValue}>{monthStats.pct == null ? '–' : `${monthStats.pct}%`}</Text>
          <Text style={st.statLabel}>doses taken this month</Text>
        </Card>
        <Card style={st.statCard}>
          <Text style={st.statValue}>{monthStats.perfect}</Text>
          <Text style={st.statLabel}>perfect days</Text>
        </Card>
      </View>

      <SectionTitle>{formatDateLong(selected)}</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
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
        <Text style={st.hint}>Forgot to log something? Tap Take or ⋯ to fix the record.</Text>
      ) : null}
    </ScrollView>
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
  if (!date) return <View style={st.cell} />;
  let bg = 'transparent';
  let fg = colors.text;
  if (summary) {
    if (frozen) bg = '#7FB6F0';
    else if (summary.status === 'complete') bg = colors.good;
    else if (summary.status === 'partial') bg = colors.warn;
    else if (summary.status === 'missed') bg = colors.bad;
    if (bg !== 'transparent') fg = '#fff';
  }
  return (
    <Pressable onPress={onPress} style={st.cell}>
      <View
        style={[
          st.dayBubble,
          { backgroundColor: bg },
          isToday && { borderWidth: 2, borderColor: colors.primary },
          selected && { transform: [{ scale: 1.12 }], borderWidth: 2, borderColor: colors.text },
        ]}
      >
        <Text style={[st.dayText, { color: fg }]}>{parseDateKey(date).d}</Text>
      </View>
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10, marginTop: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  arrow: { fontSize: 30, color: colors.primary, paddingHorizontal: 12 },
  month: { fontSize: 18, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: colors.muted, marginBottom: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: '80%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  empty: { color: colors.muted, paddingVertical: 12 },
  futureRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  futureText: { fontSize: 15, color: colors.text },
  futureTime: { fontSize: 15, color: colors.muted },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});

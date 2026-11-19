import { useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { addDays, diffDays, monthName, parseDateKey, weekdayOf, type DateKey } from '../domain/dates';
import type { DaySummary } from '../domain/progress';
import { makeStyles, useTheme, type Palette } from '../theme';
import { Text } from './ui';

function cellColor(c: Palette, s: DaySummary | undefined, future: boolean, frozen: boolean) {
  if (future || !s || s.status === 'none') return c.sunken;
  if (frozen) return c.ice;
  if (s.status === 'complete') return c.primary;
  if (s.status === 'partial') return c.primary + '66';
  if (s.status === 'missed') return c.bad + '55';
  // today, in progress
  const done = s.scheduled ? (s.taken + s.skipped) / s.scheduled : 0;
  return done > 0 ? c.primary + '88' : c.sunken;
}

const mondayOf = (d: DateKey) => addDays(d, -((weekdayOf(d) + 6) % 7));

/** The last N weeks as a grid: one column per week (Mon at the top), newest on the right. */
export function YearHeatmap({ byDate, frozen, today, weeks = 53 }: { byDate: Map<DateKey, DaySummary>; frozen: Set<DateKey>; today: DateKey; weeks?: number }) {
  const c = useTheme();
  const s = useStyles();
  const scroll = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  const start = addDays(mondayOf(today), -(weeks - 1) * 7);
  const cols = Array.from({ length: weeks }, (_, w) => addDays(start, w * 7));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={scroll as never} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
      <View>
        <View style={s.months}>
          {cols.map((mon) => {
            const { d, m } = parseDateKey(mon);
            return (
              <View key={mon} style={{ width: 13, height: 14 }}>
                {d <= 7 ? (
                  <Text style={s.month} numberOfLines={1}>
                    {monthName(m).slice(0, 3)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {cols.map((mon) => (
            <View key={mon} style={{ gap: 3 }}>
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDays(mon, i);
                const future = diffDays(today, date) > 0;
                return <View key={date} style={[s.yearCell, { backgroundColor: cellColor(c, byDate.get(date), future, frozen.has(date)) }, date === today && s.todayCell]} />;
              })}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/** A month as rows of weeks, with the day number in each square. */
export function MonthHeatmap({ byDate, frozen, today }: { byDate: Map<DateKey, DaySummary>; frozen: Set<DateKey>; today: DateKey }) {
  const c = useTheme();
  const s = useStyles();
  const { y, m } = parseDateKey(today);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const start = mondayOf(first);
  const rows: DateKey[][] = [];
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
    if (parseDateKey(row[0]).m !== m && w > 0) break;
    rows.push(row);
  }
  return (
    <View style={{ gap: 6 }}>
      <View style={s.monthRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
          <Text key={i} style={s.dayLetter}>
            {l}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row[0]} style={s.monthRow}>
          {row.map((date) => {
            const inMonth = parseDateKey(date).m === m;
            const future = diffDays(today, date) > 0;
            const bg = inMonth ? cellColor(c, byDate.get(date), future, frozen.has(date)) : 'transparent';
            const filled = bg !== c.sunken && bg !== 'transparent';
            return (
              <View key={date} style={[s.monthCell, { backgroundColor: bg }, date === today && s.todayCell]}>
                {inMonth ? <Text style={[s.monthNum, { color: filled ? '#fff' : c.muted }]}>{parseDateKey(date).d}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function HeatLegend() {
  const c = useTheme();
  const s = useStyles();
  const items: [string, string][] = [
    [c.primary, 'All taken'],
    [c.primary + '66', 'Some'],
    [c.bad + '55', 'Missed'],
    [c.ice, 'Freeze'],
  ];
  return (
    <View style={s.legend}>
      {items.map(([col, label]) => (
        <View key={label} style={s.legendItem}>
          <View style={[s.legendBox, { backgroundColor: col }]} />
          <Text style={s.legendText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  months: { flexDirection: 'row', gap: 3, marginBottom: 4 },
  month: { position: 'absolute', left: 0, width: 32, fontSize: 9, fontWeight: '800', color: c.muted },
  yearCell: { width: 13, height: 13, borderRadius: 4 },
  todayCell: { borderWidth: 2, borderColor: c.text },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayLetter: { width: '13%', textAlign: 'center', fontSize: 11, fontWeight: '800', color: c.muted },
  monthCell: { width: '13%', aspectRatio: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthNum: { fontSize: 12, fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendBox: { width: 12, height: 12, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '700', color: c.muted },
}));

import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { parseDateKey, weekdayOf } from '../domain/dates';
import type { DayMark } from '../domain/progress';
import { makeStyles, useTheme } from '../theme';
import { Text } from './ui';

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A row of rounded squares, one per day, filled in the med's colour when every dose was taken. */
export function WeekSquares({ days, color, today }: { days: { date: string; mark: DayMark }[]; color: string; today: string }) {
  const c = useTheme();
  const s = useStyles();
  return (
    <View style={s.row}>
      {days.map(({ date, mark }) => {
        const isToday = date === today;
        const box =
          mark === 'taken'
            ? { backgroundColor: color, borderColor: color }
            : mark === 'partial'
              ? { backgroundColor: color + '55', borderColor: color + '55' }
              : mark === 'missed'
                ? { backgroundColor: 'transparent', borderColor: c.bad + '88' }
                : mark === 'pending'
                  ? { backgroundColor: 'transparent', borderColor: color }
                  : { backgroundColor: c.sunken, borderColor: c.sunken };
        return (
          <View key={date} style={s.col}>
            <View style={[s.box, box]}>
              {mark === 'taken' ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              {mark === 'off' ? null : mark !== 'taken' ? <Text style={[s.num, { color: mark === 'missed' ? c.bad : c.muted }]}>{parseDateKey(date).d}</Text> : null}
            </View>
            <Text style={[s.letter, isToday && { color: c.text, fontWeight: '900' }]}>{LETTER[weekdayOf(date)]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  col: { alignItems: 'center', gap: 4, flex: 1 },
  box: { width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 11, fontWeight: '800' },
  letter: { fontSize: 10, fontWeight: '800', color: c.muted },
}));

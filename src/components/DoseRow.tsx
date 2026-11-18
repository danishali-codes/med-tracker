import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Alert, Animated, Pressable, View } from 'react-native';
import { logDose } from '../actions';
import { formatTime, timeFromDate } from '../domain/dates';
import { describeDose } from '../domain/dose';
import { punctuality } from '../domain/schedule';
import type { DoseLog, Medication, ScheduledDose } from '../domain/types';
import { FORM_EMOJI, makeStyles, useTheme } from '../theme';
import { Text } from './ui';

export function DoseRow({
  dose,
  med,
  log,
  windowMinutes,
  showTime,
}: {
  dose: ScheduledDose;
  med: Medication;
  log?: DoseLog;
  windowMinutes: number;
  showTime?: boolean;
}) {
  const c = useTheme();
  const s = useStyles();
  const pop = useRef(new Animated.Value(1)).current;
  const taken = log?.status === 'taken';
  const skipped = log?.status === 'skipped';

  const prev = useRef(taken);
  useEffect(() => {
    if (taken && !prev.current) {
      pop.setValue(0.6);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 18 }).start();
    }
    prev.current = taken;
  }, [taken, pop]);

  const options = () =>
    Alert.alert(med.name, `${formatTime(dose.time)} · ${describeDose(med)}`, [
      ...(!skipped ? [{ text: 'Skip this dose', onPress: () => logDose(dose, 'skipped') }] : []),
      ...(log ? [{ text: 'Undo', onPress: () => logDose(dose, null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const toggle = () => {
    if (log) return options();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    logDose(dose, 'taken');
  };

  let status: { text: string; color: string } | null = null;
  if (taken) {
    const late = punctuality(dose, new Date(log!.at), windowMinutes) === 'late';
    status = { text: `${late ? 'Late' : 'Taken'} at ${formatTime(timeFromDate(new Date(log!.at)))}`, color: late ? c.warn : c.good };
  } else if (skipped) {
    status = { text: 'Skipped', color: c.muted };
  }

  return (
    <Pressable onLongPress={options} style={[s.row, log && { opacity: skipped ? 0.55 : 0.92 }]} delayLongPress={300}>
      <View style={[s.icon, { backgroundColor: med.color + (c.dark ? '33' : '1F') }]}>
        <Text style={s.emoji}>{FORM_EMOJI[med.form] ?? '💊'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.name, taken && s.nameDone]} numberOfLines={1}>
          {med.name}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {[showTime ? formatTime(dose.time) : null, describeDose(med)].filter(Boolean).join(' · ')}
        </Text>
        {status ? <Text style={[s.status, { color: status.color }]}>{status.text}</Text> : null}
      </View>
      <Pressable onPress={toggle} hitSlop={10} accessibilityRole="button" accessibilityLabel={log ? `${status?.text}. Change` : `Take ${med.name}`}>
        <Animated.View
          style={[
            s.check,
            taken ? { backgroundColor: c.good, borderColor: c.good } : skipped ? { backgroundColor: c.sunken, borderColor: c.sunken } : { borderColor: med.color },
            { transform: [{ scale: pop }] },
          ]}
        >
          {taken ? <Ionicons name="checkmark" size={24} color="#fff" /> : skipped ? <Ionicons name="remove" size={22} color={c.muted} /> : null}
        </Animated.View>
      </Pressable>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 14 },
  icon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  name: { fontSize: 17, fontWeight: '800', color: c.text },
  nameDone: { color: c.muted },
  sub: { fontSize: 14, color: c.muted, marginTop: 1, fontWeight: '600' },
  status: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  check: { width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
}));

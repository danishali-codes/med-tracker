import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
import { logDose, snoozeDoses } from '../actions';
import { formatTime, timeFromDate, toDateKey } from '../domain/dates';
import { describeDose } from '../domain/dose';
import { foodLabel } from '../domain/routines';
import { punctuality } from '../domain/schedule';
import type { DoseLog, Medication, ScheduledDose } from '../domain/types';
import { makeStyles, useTheme } from '../theme';
import { MedIcon } from './MedIcon';
import { ActionSheet, Text, type SheetAction } from './ui';

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

  const [sheet, setSheet] = useState(false);
  const options = () => setSheet(true);
  const isToday = dose.date === toDateKey(new Date());
  const actions: SheetAction[] = [
    ...(!taken ? [{ label: 'Taken', icon: 'checkmark-circle-outline' as const, onPress: () => logDose(dose, 'taken') }] : []),
    ...(!log && isToday
      ? [10, 30, 60].map((m) => ({
          label: m === 60 ? 'Remind me in 1 hour' : `Remind me in ${m} minutes`,
          icon: 'alarm-outline' as const,
          onPress: () => snoozeDoses(dose.date, dose.time, m),
        }))
      : []),
    ...(!skipped ? [{ label: 'Skip this dose', icon: 'remove-circle-outline' as const, onPress: () => logDose(dose, 'skipped') }] : []),
    ...(log ? [{ label: 'Undo', icon: 'arrow-undo-outline' as const, onPress: () => logDose(dose, null), destructive: true }] : []),
  ];

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
      {med.photo ? <Image source={{ uri: med.photo }} style={s.photo} accessibilityLabel={`Photo of ${med.name}`} /> : <MedIcon med={med} />}
      <View style={{ flex: 1 }}>
        <Text style={[s.name, taken && s.nameDone]} numberOfLines={1}>
          {med.name}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {[showTime ? formatTime(dose.time) : null, describeDose(med), foodLabel(med.food, med.foodWaitMinutes)].filter(Boolean).join(' · ')}
        </Text>
        {dose.usualTime ? <Text style={s.moved}>Moved from {formatTime(dose.usualTime)}</Text> : null}
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
      <ActionSheet
        visible={sheet}
        title={med.name}
        subtitle={`${formatTime(dose.time)} · ${describeDose(med)}`}
        header={med.photo ? <Image source={{ uri: med.photo }} style={s.photoBig} /> : null}
        actions={actions}
        onClose={() => setSheet(false)}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  photo: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.sunken },
  photoBig: { width: '100%', height: 220, borderRadius: 22, marginBottom: 14, backgroundColor: c.sunken },
  moved: { fontSize: 12, fontWeight: '700', color: c.primary, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 14 },
  icon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: c.text },
  nameDone: { color: c.muted },
  sub: { fontSize: 14, color: c.muted, marginTop: 1, fontWeight: '600' },
  status: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  check: { width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
}));

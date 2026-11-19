import * as Haptics from 'expo-haptics';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { logDose } from '../actions';
import { formatTime, timeFromDate } from '../domain/dates';
import { punctuality } from '../domain/schedule';
import type { DoseLog, Medication, ScheduledDose } from '../domain/types';
import { colors, FORM_EMOJI } from '../theme';
import { Button } from './ui';

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
  const take = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    logDose(dose, 'taken');
  };
  const more = () =>
    Alert.alert(med.name, `${formatTime(dose.time)} dose`, [
      { text: 'Skip this dose', onPress: () => logDose(dose, 'skipped') },
      ...(log ? [{ text: 'Undo', onPress: () => logDose(dose, null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  let status: { text: string; color: string; bg: string } | null = null;
  if (log?.status === 'taken') {
    const late = punctuality(dose, new Date(log.at), windowMinutes) === 'late';
    status = {
      text: `${late ? 'Late' : 'Taken'} · ${formatTime(timeFromDate(new Date(log.at)))}`,
      color: late ? colors.warn : colors.good,
      bg: late ? colors.warnSoft : colors.goodSoft,
    };
  } else if (log?.status === 'skipped') {
    status = { text: 'Skipped', color: colors.muted, bg: colors.border };
  }

  return (
    <View style={s.row}>
      <View style={[s.icon, { backgroundColor: med.color + '22' }]}>
        <Text style={s.emoji}>{FORM_EMOJI[med.form] ?? '💊'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{med.name}</Text>
        <Text style={s.sub}>
          {[showTime ? formatTime(dose.time) : null, med.dose].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {status ? (
        <Pressable onPress={more} style={[s.status, { backgroundColor: status.bg }]} accessibilityLabel={`${status.text}. Tap to change`}>
          <Text style={[s.statusText, { color: status.color }]}>{status.text}</Text>
        </Pressable>
      ) : (
        <View style={s.actions}>
          <Pressable onPress={more} hitSlop={8} style={s.more} accessibilityLabel="More options">
            <Text style={s.moreText}>⋯</Text>
          </Pressable>
          <Button title="Take" small onPress={take} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  status: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  more: { paddingHorizontal: 6 },
  moreText: { fontSize: 22, color: colors.muted },
});

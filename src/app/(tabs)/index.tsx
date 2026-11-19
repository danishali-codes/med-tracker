import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { logAsNeeded } from '../../actions';
import { DoseRow } from '../../components/DoseRow';
import { Button, Card, Ring, SectionTitle } from '../../components/ui';
import { atTime, formatDateLong, formatTime, timeFromDate } from '../../domain/dates';
import { dosesOn, groupByTime, indexLogs } from '../../domain/schedule';
import * as repo from '../../db/repo';
import { useDbVersion, useMeds, useProgress, useSettings } from '../../hooks/useData';
import { getPermissionState, requestExactAlarms, requestNotificationPermission, type PermissionState } from '../../notifications/permissions';
import { rescheduleAll } from '../../notifications/reminders';
import { colors, FORM_EMOJI } from '../../theme';

export default function TodayScreen() {
  const meds = useMeds();
  const settings = useSettings();
  const version = useDbVersion();
  const { today, progress, coins, byDate } = useProgress();
  const [perm, setPerm] = useState<PermissionState | null>(null);

  const refreshPerm = useCallback(() => {
    getPermissionState().then(setPerm).catch(() => {});
  }, []);
  useEffect(refreshPerm, [refreshPerm, today]);

  const medById = useMemo(() => new Map(meds.map((m) => [m.id, m])), [meds]);
  const doses = useMemo(() => dosesOn(meds, today), [meds, today]);
  const logs = useMemo(() => indexLogs(repo.getLogs(today, today)), [today, version]);
  const groups = groupByTime(doses);
  const asNeeded = meds.filter((m) => !m.archived && m.schedule.pattern.kind === 'asNeeded');
  const answered = doses.filter((d) => logs.has(d.slot)).length;
  const summary = byDate.get(today);
  const now = new Date();

  const enableReminders = async () => {
    await requestNotificationPermission();
    await requestExactAlarms();
    refreshPerm();
    rescheduleAll().catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={st.container}>
      <Text style={st.date}>{formatDateLong(today)}</Text>

      {perm && (!perm.notifications || !perm.exactAlarms) ? (
        <Card style={{ backgroundColor: colors.warnSoft, borderColor: colors.warn }}>
          <Text style={st.bannerTitle}>{!perm.notifications ? 'Reminders are off' : 'Reminders may arrive late'}</Text>
          <Text style={st.bannerText}>
            {!perm.notifications
              ? 'Allow notifications so the app can remind you when a dose is due.'
              : 'Allow "Alarms & reminders" so doses ring on time, even when battery saving is on.'}
          </Text>
          <Button title="Turn on" onPress={enableReminders} style={{ marginTop: 10, alignSelf: 'flex-start' }} small />
        </Card>
      ) : null}

      <Card style={st.hero}>
        <Ring value={answered} total={doses.length} size={116}>
          <Text style={st.ringBig}>
            {answered}/{doses.length}
          </Text>
          <Text style={st.ringSmall}>{doses.length === 0 ? 'nothing due' : 'doses done'}</Text>
        </Ring>
        <View style={st.stats}>
          <Stat emoji="🔥" value={`${progress.currentStreak}`} label="day streak" />
          <Stat emoji="🪙" value={`${coins}`} label="coins" />
          <Stat emoji="❄️" value={`${progress.freezes}`} label={progress.freezes === 1 ? 'streak freeze' : 'streak freezes'} />
        </View>
      </Card>
      {summary?.status === 'complete' && doses.length > 0 ? (
        <Text style={st.cheer}>All done for today. Nice work! 🎉</Text>
      ) : null}

      {meds.filter((m) => !m.archived).length === 0 ? (
        <Card>
          <Text style={st.emptyTitle}>Add your first medication</Text>
          <Text style={st.bannerText}>Set its schedule once and the app reminds you every time it's due.</Text>
          <Button title="Add medication" onPress={() => router.push('/med/new')} style={{ marginTop: 12 }} />
        </Card>
      ) : null}

      {groups.map((g) => {
        const pending = g.doses.some((d) => !logs.has(d.slot));
        const overdue = pending && atTime(today, g.time) < now;
        return (
          <View key={g.time}>
            <SectionTitle right={overdue ? <Text style={st.overdue}>Due</Text> : null}>{formatTime(g.time)}</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {g.doses.map((d) => {
                const med = medById.get(d.medId);
                return med ? <DoseRow key={d.slot} dose={d} med={med} log={logs.get(d.slot)} windowMinutes={settings.onTimeWindowMinutes} /> : null;
              })}
            </Card>
          </View>
        );
      })}

      {asNeeded.length > 0 ? (
        <>
          <SectionTitle>As needed</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {asNeeded.map((m) => {
              const last = repo
                .getLogs(today, today)
                .filter((l) => l.medId === m.id)
                .sort((a, b) => b.at.localeCompare(a.at))[0];
              return (
                <View key={m.id} style={st.prnRow}>
                  <Text style={{ fontSize: 20 }}>{FORM_EMOJI[m.form]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.prnName}>{m.name}</Text>
                    <Text style={st.prnSub}>{last ? `Last today at ${formatTime(timeFromDate(new Date(last.at)))}` : m.dose || 'Not taken today'}</Text>
                  </View>
                  <Button title="Log dose" small kind="secondary" onPress={() => logAsNeeded(m)} />
                </View>
              );
            })}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <View style={st.stat}>
      <Text style={st.statEmoji}>{emoji}</Text>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  date: { fontSize: 15, color: colors.muted, marginBottom: 12 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringBig: { fontSize: 24, fontWeight: '800', color: colors.text },
  ringSmall: { fontSize: 11, color: colors.muted },
  stats: { flex: 1, gap: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 13, color: colors.muted },
  cheer: { textAlign: 'center', color: colors.good, fontWeight: '600', marginBottom: 8 },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  bannerText: { fontSize: 14, color: colors.muted, marginTop: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  overdue: { fontSize: 12, fontWeight: '700', color: colors.bad },
  prnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  prnName: { fontSize: 16, fontWeight: '600', color: colors.text },
  prnSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
});

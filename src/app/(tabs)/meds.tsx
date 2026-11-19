import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionTitle } from '../../components/ui';
import { formatDateLong } from '../../domain/dates';
import { medStreak } from '../../domain/progress';
import { describeSchedule, indexLogs, nextDueDate } from '../../domain/schedule';
import type { Medication } from '../../domain/types';
import * as repo from '../../db/repo';
import { useDbVersion, useMeds, useToday } from '../../hooks/useData';
import { colors, FORM_EMOJI } from '../../theme';

export default function MedsScreen() {
  const meds = useMeds();
  const today = useToday();
  const version = useDbVersion();
  const [showArchived, setShowArchived] = useState(false);
  const logs = useMemo(() => indexLogs(repo.getLogs()), [version]);
  const active = meds.filter((m) => !m.archived);
  const archived = meds.filter((m) => m.archived);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Button title="+ Add medication" onPress={() => router.push('/med/new')} style={{ marginBottom: 16 }} />
      {active.length === 0 ? <Text style={st.empty}>No medications yet.</Text> : null}
      {active.map((m) => (
        <MedCard key={m.id} med={m} today={today} streak={medStreak(m, logs, today)} />
      ))}
      {archived.length > 0 ? (
        <>
          <SectionTitle
            right={
              <Pressable onPress={() => setShowArchived(!showArchived)}>
                <Text style={{ color: colors.primary }}>{showArchived ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          >
            Archived ({archived.length})
          </SectionTitle>
          {showArchived ? archived.map((m) => <MedCard key={m.id} med={m} today={today} streak={0} />) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function MedCard({ med, today, streak }: { med: Medication; today: string; streak: number }) {
  const next = med.archived || med.schedule.pattern.kind === 'asNeeded' ? null : nextDueDate(med.schedule, today);
  const low = med.stock != null && med.refillAt != null && med.stock <= med.refillAt;
  return (
    <Pressable onPress={() => router.push({ pathname: '/med/[id]', params: { id: med.id } })}>
      <Card style={med.archived ? { opacity: 0.6 } : undefined}>
        <View style={st.row}>
          <View style={[st.icon, { backgroundColor: med.color + '22' }]}>
            <Text style={{ fontSize: 22 }}>{FORM_EMOJI[med.form]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.name}>
              {med.name} {med.dose ? <Text style={st.dose}>{med.dose}</Text> : null}
            </Text>
            <Text style={st.sub}>{describeSchedule(med.schedule)}</Text>
            {next && next !== today ? <Text style={st.sub}>Next: {formatDateLong(next)}</Text> : null}
            <View style={st.tags}>
              {streak > 0 ? <Text style={st.tag}>🔥 {streak}</Text> : null}
              {med.stock != null ? (
                <Text style={[st.tag, low && { backgroundColor: colors.badSoft, color: colors.bad }]}>
                  {low ? '⚠️ ' : ''}
                  {med.stock} left
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={st.chev}>›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const st = StyleSheet.create({
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  dose: { fontSize: 14, fontWeight: '400', color: colors.muted },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tag: { fontSize: 12, backgroundColor: colors.bg, color: colors.text, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  chev: { fontSize: 26, color: colors.neutral },
});

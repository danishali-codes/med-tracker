import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { changePart, logAsNeeded } from '../actions';
import { addDays, formatTime, timeFromDate, type DateKey } from '../domain/dates';
import { describeNight, machineKind, partDueText, partsDue } from '../domain/machines';
import { dosesOn } from '../domain/schedule';
import type { DoseLog, Medication, ScheduledDose } from '../domain/types';
import * as repo from '../db/repo';
import { makeStyles, useTheme } from '../theme';
import { DoseRow } from './DoseRow';
import { MedIcon } from './MedIcon';
import { Button, Card, FadeIn, SectionTitle, Text } from './ui';

/**
 * Today's machines (CPAP, nebulizer...): the check-in, last night's details and any part
 * that's due. Kept apart from medicines, so it never touches the streak.
 */
export function MachinesSection({
  machines,
  doses,
  logs,
  todayLogs,
  today,
  windowMinutes,
  version,
}: {
  machines: Medication[];
  doses: ScheduledDose[];
  logs: Map<string, DoseLog>;
  todayLogs: DoseLog[];
  today: DateKey;
  windowMinutes: number;
  version: number;
}) {
  const c = useTheme();
  const s = useStyles();
  const due = useMemo(() => partsDue(machines, today, 0), [machines, today]);
  const yesterday = addDays(today, -1);
  // Last night: a nightly machine checked in yesterday, and what was noted about it.
  const lastNights = useMemo(
    () =>
      machines
        .filter((m) => machineKind(m.machine?.type).nightly && m.schedule.pattern.kind !== 'asNeeded')
        .map((m) => {
          const used = dosesOn([m], yesterday).some((d) => repo.getLog(d.slot)?.status === 'taken');
          return { med: m, used, night: used ? repo.getNight(m.id, yesterday) : null };
        })
        .filter((x) => x.used),
    [machines, yesterday, version],
  );
  const asNeeded = machines.filter((m) => m.schedule.pattern.kind === 'asNeeded');
  if (machines.length === 0) return null;
  const answered = doses.filter((d) => logs.has(d.slot)).length;

  return (
    <FadeIn delay={150}>
      <SectionTitle right={doses.length > 0 && answered === doses.length ? <Text style={[s.tag, { color: c.good, backgroundColor: c.goodSoft }]}>Done</Text> : null}>
        Machines
      </SectionTitle>
      <Card style={{ paddingVertical: 6 }}>
        {doses.map((d) => {
          const med = machines.find((m) => m.id === d.medId);
          return med ? <DoseRow key={d.slot} dose={d} med={med} log={logs.get(d.slot)} windowMinutes={windowMinutes} showTime /> : null;
        })}
        {asNeeded.map((m) => {
          const last = todayLogs.filter((l) => l.medId === m.id).sort((a, b) => b.at.localeCompare(a.at))[0];
          return (
            <View key={m.id} style={s.row}>
              <MedIcon med={m} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{m.name}</Text>
                <Text style={s.sub}>{last ? `Last used today at ${formatTime(timeFromDate(new Date(last.at)))}` : 'Log it each time you use it'}</Text>
              </View>
              <Button title="Log" small kind="secondary" onPress={() => logAsNeeded(m)} />
            </View>
          );
        })}
        {lastNights.map(({ med, night }) => (
          <Pressable
            key={med.id}
            onPress={() => router.push({ pathname: '/machine/night', params: { id: med.id, date: yesterday } })}
            style={s.lastNight}
            accessibilityRole="button"
          >
            <Ionicons name={night ? 'moon' : 'create-outline'} size={18} color={c.primary} />
            <Text style={s.lastNightText} numberOfLines={1}>
              {night ? `Last night${machines.length > 1 ? ` (${med.name})` : ''}: ${describeNight(night) || 'notes added'}` : `How was last night${machines.length > 1 ? ` on ${med.name}` : ''}?`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.faint} />
          </Pressable>
        ))}
        {due.map(({ med, part }) => (
          <View key={`${med.id}|${part.id}`} style={s.row}>
            <View style={[s.partIcon, { backgroundColor: c.warnSoft }]}>
              <Ionicons name="construct-outline" size={20} color={c.warn} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {part.name}
              </Text>
              <Text style={[s.sub, { color: c.warn }]} numberOfLines={1}>
                {machines.length > 1 ? `${med.name} · ` : ''}
                {partDueText(part, today)}
              </Text>
            </View>
            <Button title="Changed" small kind="secondary" onPress={() => changePart(med.id, part.id, today)} />
          </View>
        ))}
      </Card>
      <Text style={s.hint}>Machines never affect your streak.</Text>
    </FadeIn>
  );
}

const useStyles = makeStyles((c) => ({
  tag: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  name: { fontSize: 17, fontWeight: '800', color: c.text },
  sub: { fontSize: 14, color: c.muted, marginTop: 1, fontWeight: '600' },
  partIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  lastNight: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border },
  lastNightText: { flex: 1, fontSize: 14, fontWeight: '700', color: c.primary },
  hint: { fontSize: 13, color: c.muted, fontWeight: '600', marginTop: -4, marginBottom: 10, marginLeft: 6 },
}));

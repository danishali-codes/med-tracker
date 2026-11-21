import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { changePart, removeMedication, saveMedication } from '../../actions';
import { MedIcon } from '../../components/MedIcon';
import { popup } from '../../components/Popup';
import { DateButton, TimeButton } from '../../components/Pickers';
import { PageScroll } from '../../components/Screen';
import { Button, Card, Field, Input, PressableScale, Select, Text } from '../../components/ui';
import { addDays, formatDateLong, toDateKey, type TimeOfDay } from '../../domain/dates';
import { defaultParts, describeNight, everyText, EVERY_OPTIONS, MACHINE_KINDS, machineKind, machineUsage, partDueText, partDaysLeft } from '../../domain/machines';
import { indexLogs } from '../../domain/schedule';
import type { MachinePart, MachineType, Medication } from '../../domain/types';
import * as repo from '../../db/repo';
import { useDbVersion } from '../../hooks/useData';
import { makeStyles, MED_COLORS, useTheme } from '../../theme';

type Mode = 'daily' | 'asNeeded';

export default function MachineEditor() {
  const c = useTheme();
  const st = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const version = useDbVersion();
  const existing = useMemo(() => (id && id !== 'new' ? repo.getMed(id) : null), [id, version]);
  const today = toDateKey(new Date());

  const [type, setType] = useState<MachineType>(existing?.machine?.type ?? 'cpap');
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? MED_COLORS[4]);
  const [mode, setMode] = useState<Mode>(existing?.schedule.pattern.kind === 'asNeeded' ? 'asNeeded' : 'daily');
  const [time, setTime] = useState<TimeOfDay>(existing?.schedule.times[0] ?? machineKind('cpap').time);
  const [parts, setParts] = useState<MachinePart[]>(existing?.machine?.parts ?? defaultParts('cpap', today, repo.newId));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const kind = machineKind(type);

  const pickType = (t: MachineType) => {
    setType(t);
    // A new machine starts from the usual schedule for its kind; an existing one keeps its own.
    if (!existing) {
      setParts(defaultParts(t, today, repo.newId));
      setTime(machineKind(t).time);
      setMode(t === 'nebulizer' ? 'asNeeded' : 'daily');
    }
  };

  const updatePart = (pid: string, patch: Partial<MachinePart>) => setParts((ps) => ps.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  const addPart = () => setParts((ps) => [...ps, { id: repo.newId(), name: '', everyDays: 30, lastChanged: today }]);
  const removePart = (pid: string) => setParts((ps) => ps.filter((p) => p.id !== pid));

  const build = (): Medication => ({
    id: existing?.id ?? repo.newId(),
    name: name.trim(),
    strength: '',
    amount: 1,
    form: 'other',
    color,
    schedule:
      mode === 'daily'
        ? { pattern: { kind: 'daily' }, times: [time], startDate: existing?.schedule.startDate ?? today }
        : { pattern: { kind: 'asNeeded' }, times: [], startDate: existing?.schedule.startDate ?? today },
    stock: null,
    refillAt: null,
    archived: existing?.archived ?? false,
    archivedAt: existing?.archivedAt ?? null,
    pauses: existing?.pauses,
    notes: notes.trim() || undefined,
    machine: { type, parts: parts.filter((p) => p.name.trim()).map((p) => ({ ...p, name: p.name.trim() })) },
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });

  const save = async () => {
    if (!name.trim()) return popup('Add a name', 'What do you call this machine? For example "CPAP".');
    const before = existing?.schedule.pattern.kind !== 'asNeeded' ? existing?.schedule.times[0] : undefined;
    const moves = before && mode === 'daily' && before !== time ? [{ from: before, to: time }] : [];
    await saveMedication(build(), moves);
    router.back();
  };

  const archive = async () => {
    if (!existing) return;
    await saveMedication({ ...existing, archived: !existing.archived, archivedAt: existing.archived ? null : new Date().toISOString() });
    router.back();
  };

  const remove = () =>
    popup('Delete machine?', 'This removes it, its check-ins and its nights. Your medicine streak is not affected. Archive it instead to keep its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (existing) await removeMedication(existing.id);
          router.back();
        },
      },
    ]);

  // The last 30 days, for a machine that has some history.
  const from = addDays(today, -29);
  const nights = useMemo(() => (existing ? repo.getNights(from, today, existing.id) : []), [existing, from, today, version]);
  const usage = useMemo(() => {
    if (!existing || existing.schedule.pattern.kind === 'asNeeded') return null;
    const logs = indexLogs(repo.getLogs(from, today).filter((l) => l.medId === existing.id));
    // Tonight's check-in may not be due yet, so the 30 days end yesterday.
    return machineUsage(existing, logs, nights, from, addDays(today, -1));
  }, [existing, from, today, nights, version]);

  const typeLabel = existing ? (existing.archived ? 'Archived machine' : 'Edit machine') : 'New machine';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: typeLabel }} />
      <PageScroll contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={st.headRow}>
            <MedIcon med={{ form: 'other', color, machine: { type, parts: [] } }} size={54} />
            <Text style={[st.hint, { flex: 1 }]}>
              Check in when you use it and get reminded when parts are due. It has its own place on Today, and never counts towards your streak.
            </Text>
          </View>
          <Field label="Type">
            <Select title="Type" value={type} onChange={pickType} options={MACHINE_KINDS.map((k) => ({ value: k.type, label: k.label }))} />
          </Field>
          <Field label="Name" style={{ marginBottom: 0 }}>
            <Input value={name} onChangeText={setName} placeholder={type === 'cpap' ? 'e.g. CPAP or prisma SMART' : 'e.g. Nebulizer'} autoFocus={!existing} autoCorrect={false} />
          </Field>
        </Card>

        {usage && usage.due > 0 ? (
          <Card>
            <Text style={st.cardTitle}>Last 30 days</Text>
            <View style={st.stats}>
              <Stat label={kind.nightly ? 'Nights used' : 'Days used'} value={`${usage.used} of ${usage.due}`} />
              {usage.avgHours != null ? <Stat label="Average" value={`${usage.avgHours} h`} /> : null}
              {usage.nightsWithHours > 0 ? <Stat label="4 h or more" value={`${usage.fourHourNights} of ${usage.nightsWithHours}`} /> : null}
              {usage.avgAhi != null ? <Stat label="Average AHI" value={String(usage.avgAhi)} /> : null}
            </View>
            {nights.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                {[...nights]
                  .reverse()
                  .slice(0, 7)
                  .map((n) => (
                    <Pressable key={n.date} onPress={() => router.push({ pathname: '/machine/night', params: { id: n.medId, date: n.date } })} style={st.nightRow}>
                      <Text style={st.nightDate}>{formatDateLong(n.date)}</Text>
                      <Text style={st.nightText} numberOfLines={1}>
                        {describeNight(n) || n.note}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <Text style={st.cardTitle}>Check-in</Text>
          <Field label="When">
            <Select
              title="When"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'daily', label: kind.nightly ? 'Every night, with a reminder' : 'Every day, with a reminder' },
                { value: 'asNeeded', label: 'When I use it, no reminder' },
              ]}
            />
          </Field>
          {mode === 'daily' ? (
            <Field label="Reminder" hint={kind.nightly ? 'Around bedtime works well. Tap Taken once it\'s on.' : undefined} style={{ marginBottom: 0 }}>
              <TimeButton value={time} onChange={setTime} />
            </Field>
          ) : (
            <Text style={st.hint}>Log it from Today each time you use it.</Text>
          )}
        </Card>

        <Card>
          <Text style={st.cardTitle}>Parts</Text>
          <Text style={[st.hint, { marginTop: -8, marginBottom: 12 }]}>
            A reminder comes on the day each part is due. These are the usual times; follow what your supplier or the manual says.
          </Text>
          {parts.map((p) => {
            const options = [...new Set([...EVERY_OPTIONS, p.everyDays])].sort((a, b) => a - b);
            const left = partDaysLeft(p, today);
            return (
              <View key={p.id} style={st.part}>
                <View style={st.partTop}>
                  <Input value={p.name} onChangeText={(t) => updatePart(p.id, { name: t })} placeholder="Part name" style={{ flex: 1 }} />
                  <Pressable onPress={() => removePart(p.id)} hitSlop={10} accessibilityLabel={`Remove ${p.name || 'part'}`}>
                    <Ionicons name="close-circle" size={26} color={c.faint} />
                  </Pressable>
                </View>
                <View style={st.partRow}>
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Select
                      title="Replace"
                      value={String(p.everyDays)}
                      onChange={(v) => updatePart(p.id, { everyDays: Number(v) })}
                      options={options.map((d) => ({ value: String(d), label: everyText(d) }))}
                    />
                  </View>
                </View>
                <Text style={st.label}>Last changed</Text>
                <View style={st.partRow}>
                  <DateButton value={p.lastChanged} onChange={(d) => updatePart(p.id, { lastChanged: d > today ? today : d })} />
                  {p.lastChanged !== today ? (
                    <Button
                      title="Changed today"
                      kind="secondary"
                      small
                      onPress={() => {
                        updatePart(p.id, { lastChanged: today });
                        if (existing?.machine?.parts.some((x) => x.id === p.id)) changePart(existing.id, p.id, today).catch(() => {});
                      }}
                    />
                  ) : null}
                </View>
                {p.name.trim() ? <Text style={[st.due, { color: left <= 0 ? c.warn : c.muted }]}>{partDueText(p, today)}</Text> : null}
              </View>
            );
          })}
          <Button title="Add a part" kind="secondary" small onPress={addPart} icon={<Ionicons name="add" size={16} color={c.primary} />} style={{ alignSelf: 'flex-start' }} />
        </Card>

        <Card>
          <Field label="Colour">
            <View style={st.wrap}>
              {MED_COLORS.map((col) => (
                <PressableScale key={col} onPress={() => setColor(col)} haptic style={[st.swatch, { backgroundColor: col }, color === col && st.swatchOn]} accessibilityLabel={`Colour ${col}`}>
                  {color === col ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                </PressableScale>
              ))}
            </View>
          </Field>
          <Field label="Notes" style={{ marginBottom: 0 }}>
            <Input value={notes} onChangeText={setNotes} placeholder="e.g. pressure 8 to 12, mask size M" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
          </Field>
        </Card>

        <Button title="Save" onPress={save} />
        {existing ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            <Button title={existing.archived ? 'Unarchive' : 'Archive'} kind="secondary" onPress={archive} style={{ flexGrow: 1 }} />
            <Button title="Delete" kind="danger" onPress={remove} style={{ flexGrow: 1 }} />
          </View>
        ) : null}
      </PageScroll>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const st = useStyles();
  return (
    <View style={st.stat}>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { padding: 16, paddingBottom: 60 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: c.text, marginBottom: 14 },
  hint: { fontSize: 13, color: c.muted, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '800', color: c.muted, marginTop: 10, marginBottom: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { backgroundColor: c.sunken, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, minWidth: 120, flexGrow: 1 },
  statValue: { fontSize: 18, fontWeight: '900', color: c.text },
  statLabel: { fontSize: 12, fontWeight: '700', color: c.muted, marginTop: 2 },
  nightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
  nightDate: { fontSize: 13, fontWeight: '800', color: c.text, width: 120 },
  nightText: { flex: 1, fontSize: 13, fontWeight: '600', color: c.muted },
  part: { borderWidth: 1.5, borderColor: c.border, borderRadius: 18, padding: 12, marginBottom: 10 },
  partTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  partRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  due: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  swatch: { width: 38, height: 38, borderRadius: 19, marginRight: 10, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: c.card, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
}));

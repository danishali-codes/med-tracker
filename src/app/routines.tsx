import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';
import { popup } from '../components/Popup';
import { PageScroll } from '../components/Screen';
import { MedIcon } from '../components/MedIcon';
import { TimeButton } from '../components/Pickers';
import { useRowStyles } from '../components/ToggleRow';
import { Button, Card, Field, Input, PressableScale, SectionTitle, Text } from '../components/ui';
import { formatTime, toDateKey } from '../domain/dates';
import { describeDose } from '../domain/dose';
import { applyRoutine, routineMembers } from '../domain/routines';
import type { Routine } from '../domain/types';
import * as repo from '../db/repo';
import { useMeds, useSettings } from '../hooks/useData';
import { rescheduleAll } from '../notifications/reminders';
import { useTheme } from '../theme';

const SUGGESTED = ['Breakfast', 'Lunch', 'Dinner', 'Bedtime', 'Morning', 'Evening'];

/** Named times that group the medicines you take together, with one reminder and Take all. */
export default function RoutinesScreen() {
  const c = useTheme();
  const st = useRowStyles();
  const settings = useSettings();
  const meds = useMeds();
  const active = meds.filter((m) => !m.archived && m.schedule.pattern.kind !== 'asNeeded');
  const [editing, setEditing] = useState<{ original: Routine | null; name: string; time: string; members: Set<string> } | null>(null);

  const startNew = () => setEditing({ original: null, name: '', time: '08:00', members: new Set() });
  const startEdit = (r: Routine) => setEditing({ original: r, name: r.name, time: r.time, members: new Set(routineMembers(r, meds).map((m) => m.id)) });

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return popup('Name it', 'Give the routine a name, like Breakfast.');
    const clash = settings.routines.find((r) => r.time === editing.time && r.id !== editing.original?.id);
    if (clash) return popup('Time taken', `${clash.name} is already at ${formatTime(clash.time)}. Pick another time, or add these medicines to ${clash.name}.`);
    // A medicine taken out of the routine can't be left with no time at all.
    const stranded = editing.original
      ? routineMembers(editing.original, meds).filter((m) => !editing.members.has(m.id) && m.schedule.times.length === 1)
      : [];
    if (stranded.length) {
      return popup(
        "Can't take these out",
        `${stranded.map((m) => m.name).join(', ')} ${stranded.length === 1 ? 'has' : 'have'} no other time. Change ${stranded.length === 1 ? 'its' : 'their'} time in the medicine first.`,
      );
    }
    const routine: Routine = { id: editing.original?.id ?? repo.newId(), name, time: editing.time };
    const today = toDateKey(new Date());
    for (const m of applyRoutine(meds, routine, editing.original, editing.members)) {
      const before = meds.find((x) => x.id === m.id);
      if (before) repo.saveMedRetimed(before, m, today);
    }
    const routines = [...settings.routines.filter((r) => r.id !== routine.id), routine].sort((a, b) => (a.time < b.time ? -1 : 1));
    repo.saveSettings({ ...repo.getSettings(), routines });
    await rescheduleAll().catch(() => {});
    setEditing(null);
  };

  const remove = (r: Routine) =>
    popup(`Remove ${r.name}?`, 'The medicines keep their times; they just lose the group name.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          repo.saveSettings({ ...settings, routines: settings.routines.filter((x) => x.id !== r.id) });
          rescheduleAll().catch(() => {});
          setEditing(null);
        },
      },
    ]);

  if (editing) {
    return (
      <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Name">
            <Input value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} placeholder="e.g. Breakfast" />
          </Field>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {SUGGESTED.filter((n) => !settings.routines.some((r) => r.name === n && r.id !== editing.original?.id)).map((n) => (
              <PressableScale key={n} onPress={() => setEditing({ ...editing, name: n })} style={{ backgroundColor: c.sunken, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{n}</Text>
              </PressableScale>
            ))}
          </View>
          <Field label="Time">
            <TimeButton value={editing.time} onChange={(time) => setEditing({ ...editing, time })} />
          </Field>
        </Card>
        <SectionTitle>Medicines</SectionTitle>
        <Card style={{ paddingVertical: 6 }}>
          {active.length === 0 ? <Text style={[st.hint, { paddingVertical: 12 }]}>Add a medicine with a schedule first.</Text> : null}
          {active.map((m) => {
            const on = editing.members.has(m.id);
            return (
              <PressableScale
                key={m.id}
                onPress={() => {
                  const members = new Set(editing.members);
                  if (on) members.delete(m.id);
                  else members.add(m.id);
                  setEditing({ ...editing, members });
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
              >
                <MedIcon med={m} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={st.label}>{m.name}</Text>
                  <Text style={st.hint}>
                    {describeDose(m)} · {m.schedule.times.map(formatTime).join(', ')}
                  </Text>
                </View>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? c.primary : c.faint} />
              </PressableScale>
            );
          })}
        </Card>
        <Text style={[st.hint, { marginTop: 10, marginHorizontal: 4 }]}>
          Ticked medicines are reminded at {formatTime(editing.time)} together, and Today shows them under {editing.name.trim() || 'this routine'} with a Take all
          button.{editing.original && editing.original.time !== editing.time ? ` Their ${formatTime(editing.original.time)} time moves to ${formatTime(editing.time)}.` : ''}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
          <Button title="Cancel" kind="secondary" onPress={() => setEditing(null)} style={{ flexGrow: 1 }} />
          <Button title="Save" onPress={save} style={{ flexGrow: 1 }} />
        </View>
        {editing.original ? <Button title="Remove routine" kind="ghost" onPress={() => remove(editing.original!)} style={{ marginTop: 8 }} /> : null}
      </PageScroll>
    );
  }

  return (
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={st.hint}>
        A routine is a time you take several medicines together, like Breakfast at 8:00. They share one reminder, which says the routine's name, and one Take all
        button.
      </Text>
      {settings.routines.map((r) => {
        const members = routineMembers(r, meds);
        return (
          <PressableScale key={r.id} onPress={() => startEdit(r)} style={st.linkCard}>
            <View style={{ width: 52, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: c.primary }}>{formatTime(r.time)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>{r.name}</Text>
              <Text style={st.hint} numberOfLines={2}>
                {members.length ? members.map((m) => m.name).join(', ') : 'No medicines yet'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.faint} />
          </PressableScale>
        );
      })}
      <Button title="New routine" onPress={startNew} style={{ marginTop: 16 }} />
    </PageScroll>
  );
}

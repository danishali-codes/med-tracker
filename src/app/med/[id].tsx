import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { removeMedication, saveMedication } from '../../actions';
import { Button, Chip, Field, Input } from '../../components/ui';
import { atTime, dateFromKey, formatDateLong, formatTime, timeFromDate, toDateKey, weekdayShort, type DateKey, type TimeOfDay } from '../../domain/dates';
import { describeSchedule, nextDueDate } from '../../domain/schedule';
import type { MedForm, Medication, SchedulePattern } from '../../domain/types';
import * as repo from '../../db/repo';
import { colors, FORM_EMOJI, MED_COLORS } from '../../theme';

type Kind = SchedulePattern['kind'];

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'daily', label: 'Every day' },
  { kind: 'weekdays', label: 'Days of the week' },
  { kind: 'interval', label: 'Every few days / weeks' },
  { kind: 'cycle', label: 'On / off cycle' },
  { kind: 'monthly', label: 'Monthly' },
  { kind: 'asNeeded', label: 'As needed' },
];

const FORMS: MedForm[] = ['pill', 'capsule', 'liquid', 'injection', 'drops', 'inhaler', 'patch', 'other'];
const SUGGESTED_TIMES = ['08:00', '20:00', '13:00', '22:00', '06:00', '17:00'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const num = (s: string, fallback: number) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export default function MedEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useMemo(() => (id && id !== 'new' ? repo.getMed(id) : null), [id]);
  const today = toDateKey(new Date());

  const [name, setName] = useState(existing?.name ?? '');
  const [dose, setDose] = useState(existing?.dose ?? '');
  const [form, setForm] = useState<MedForm>(existing?.form ?? 'pill');
  const [color, setColor] = useState(existing?.color ?? MED_COLORS[repo.getMeds().length % MED_COLORS.length]);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const p = existing?.schedule.pattern;
  const [kind, setKind] = useState<Kind>(p?.kind ?? 'daily');
  const [days, setDays] = useState<number[]>(p?.kind === 'weekdays' ? p.days : [1, 3, 5]);
  const [every, setEvery] = useState(String(p?.kind === 'interval' ? p.every : 2));
  const [unit, setUnit] = useState<'day' | 'week'>(p?.kind === 'interval' ? p.unit : 'week');
  const [onDays, setOnDays] = useState(String(p?.kind === 'cycle' ? p.onDays : 21));
  const [offDays, setOffDays] = useState(String(p?.kind === 'cycle' ? p.offDays : 7));
  const [dayOfMonth, setDayOfMonth] = useState(String(p?.kind === 'monthly' ? p.dayOfMonth : new Date().getDate()));
  const [times, setTimes] = useState<TimeOfDay[]>(existing?.schedule.times.length ? existing.schedule.times : ['08:00']);
  const [startDate, setStartDate] = useState<DateKey>(existing?.schedule.startDate ?? today);
  const [endDate, setEndDate] = useState<DateKey | null>(existing?.schedule.endDate ?? null);
  const [trackStock, setTrackStock] = useState(existing?.stock != null);
  const [stock, setStock] = useState(String(existing?.stock ?? 30));
  const [perDose, setPerDose] = useState(String(existing?.perDose ?? 1));
  const [refillAt, setRefillAt] = useState(String(existing?.refillAt ?? 7));

  const pattern = (): SchedulePattern => {
    switch (kind) {
      case 'daily':
        return { kind };
      case 'weekdays':
        return { kind, days: [...days].sort() };
      case 'interval':
        return { kind, every: num(every, 1), unit };
      case 'cycle':
        return { kind, onDays: num(onDays, 21), offDays: Math.max(0, parseInt(offDays, 10) || 0) };
      case 'monthly':
        return { kind, dayOfMonth: Math.min(31, num(dayOfMonth, 1)) };
      case 'asNeeded':
        return { kind };
    }
  };

  const build = (): Medication => ({
    id: existing?.id ?? repo.newId(),
    name: name.trim(),
    dose: dose.trim(),
    form,
    color,
    notes: notes.trim() || undefined,
    schedule: {
      pattern: pattern(),
      times: kind === 'asNeeded' ? [] : [...new Set(times)].sort(),
      startDate,
      endDate,
    },
    stock: trackStock ? Math.max(0, parseInt(stock, 10) || 0) : null,
    perDose: num(perDose, 1),
    refillAt: trackStock ? Math.max(0, parseInt(refillAt, 10) || 0) : null,
    archived: existing?.archived ?? false,
    archivedAt: existing?.archivedAt ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });

  const preview = (() => {
    try {
      const s = build().schedule;
      const next = kind === 'asNeeded' ? null : nextDueDate(s, today);
      return `${describeSchedule(s)}${next ? `\nNext dose: ${next === today ? 'today' : formatDateLong(next)}` : ''}`;
    } catch {
      return '';
    }
  })();

  const save = async () => {
    if (!name.trim()) return Alert.alert('Add a name', 'What is this medication called?');
    if (kind !== 'asNeeded' && times.length === 0) return Alert.alert('Add a time', 'When should you take it?');
    if (kind === 'weekdays' && days.length === 0) return Alert.alert('Pick a day', 'Choose at least one day of the week.');
    await saveMedication(build());
    router.back();
  };

  const archive = async () => {
    if (!existing) return;
    await saveMedication({ ...existing, archived: !existing.archived, archivedAt: existing.archived ? null : new Date().toISOString() });
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete medication?', 'This also deletes its dose history. Archive it instead if you want to keep the history.', [
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

  const addTime = () => {
    const next = SUGGESTED_TIMES.find((t) => !times.includes(t)) ?? '12:00';
    setTimes([...times, next].sort());
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Edit medication' : 'New medication' }} />
      <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="e.g. Metformin" autoFocus={!existing} />
        </Field>
        <Field label="Dose" hint="Optional, e.g. 500 mg or 2 puffs">
          <Input value={dose} onChangeText={setDose} placeholder="500 mg" />
        </Field>

        <Field label="Type">
          <View style={st.wrap}>
            {FORMS.map((f) => (
              <Chip key={f} label={`${FORM_EMOJI[f]} ${f}`} selected={form === f} onPress={() => setForm(f)} />
            ))}
          </View>
        </Field>
        <Field label="Colour">
          <View style={st.wrap}>
            {MED_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={[st.swatch, { backgroundColor: c }, color === c && st.swatchOn]} />
            ))}
          </View>
        </Field>

        <Field label="How often">
          <View style={st.wrap}>
            {KINDS.map((k) => (
              <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
            ))}
          </View>
        </Field>

        {kind === 'weekdays' ? (
          <Field label="On these days">
            <View style={st.wrap}>
              {WEEK_ORDER.map((d) => (
                <Chip
                  key={d}
                  label={weekdayShort(d)}
                  selected={days.includes(d)}
                  onPress={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                />
              ))}
            </View>
          </Field>
        ) : null}

        {kind === 'interval' ? (
          <Field label="Repeat every" hint="Counted from the start date below. For every 2 weeks, set the start date to a day you take it.">
            <View style={st.inline}>
              <Input value={every} onChangeText={setEvery} keyboardType="number-pad" style={st.small} />
              <Chip label="days" selected={unit === 'day'} onPress={() => setUnit('day')} />
              <Chip label="weeks" selected={unit === 'week'} onPress={() => setUnit('week')} />
            </View>
          </Field>
        ) : null}

        {kind === 'cycle' ? (
          <Field label="Cycle" hint="Starts on the start date, e.g. 21 days on then 7 days off.">
            <View style={st.inline}>
              <Input value={onDays} onChangeText={setOnDays} keyboardType="number-pad" style={st.small} />
              <Text style={st.inlineText}>days on,</Text>
              <Input value={offDays} onChangeText={setOffDays} keyboardType="number-pad" style={st.small} />
              <Text style={st.inlineText}>days off</Text>
            </View>
          </Field>
        ) : null}

        {kind === 'monthly' ? (
          <Field label="Day of the month" hint="If a month is shorter, it falls on the last day.">
            <Input value={dayOfMonth} onChangeText={setDayOfMonth} keyboardType="number-pad" style={st.small} />
          </Field>
        ) : null}

        {kind !== 'asNeeded' ? (
          <Field label="Times">
            {times.map((t, i) => (
              <View key={`${t}-${i}`} style={st.timeRow}>
                <TimeButton value={t} onChange={(v) => setTimes(times.map((x, j) => (j === i ? v : x)).sort())} />
                {times.length > 1 ? (
                  <Pressable onPress={() => setTimes(times.filter((_, j) => j !== i))} hitSlop={10}>
                    <Text style={st.remove}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <Button title="+ Add another time" kind="ghost" small onPress={addTime} style={{ alignSelf: 'flex-start' }} />
          </Field>
        ) : null}

        <Field label="Start date">
          <DateButton value={startDate} onChange={setStartDate} />
        </Field>
        <Field label="End date">
          <View style={st.inline}>
            <Switch value={endDate != null} onValueChange={(on) => setEndDate(on ? startDate : null)} />
            {endDate ? <DateButton value={endDate} onChange={setEndDate} /> : <Text style={st.inlineText}>Ongoing</Text>}
          </View>
        </Field>

        {preview ? <Text style={st.preview}>{preview}</Text> : null}

        <Field label="Track pill count">
          <View style={st.inline}>
            <Switch value={trackStock} onValueChange={setTrackStock} />
            <Text style={st.inlineText}>{trackStock ? 'Remind me to refill' : 'Off'}</Text>
          </View>
        </Field>
        {trackStock ? (
          <View style={st.inline}>
            <Field label="Have">
              <Input value={stock} onChangeText={setStock} keyboardType="number-pad" style={st.small} />
            </Field>
            <Field label="Per dose">
              <Input value={perDose} onChangeText={setPerDose} keyboardType="number-pad" style={st.small} />
            </Field>
            <Field label="Alert at">
              <Input value={refillAt} onChangeText={setRefillAt} keyboardType="number-pad" style={st.small} />
            </Field>
          </View>
        ) : null}

        <Field label="Notes">
          <Input value={notes} onChangeText={setNotes} placeholder="e.g. take with food" multiline style={{ minHeight: 60 }} />
        </Field>

        <Button title="Save" onPress={save} />
        {existing ? (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <Button title={existing.archived ? 'Unarchive' : 'Archive'} kind="secondary" onPress={archive} style={{ flex: 1 }} />
            <Button title="Delete" kind="danger" onPress={remove} style={{ flex: 1 }} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TimeButton({ value, onChange }: { value: TimeOfDay; onChange: (t: TimeOfDay) => void }) {
  const [open, setOpen] = useState(false);
  const date = atTime(toDateKey(new Date()), value);
  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        is24Hour: false,
        onChange: (e, d) => e.type === 'set' && d && onChange(timeFromDate(d)),
      });
    } else setOpen(!open);
  };
  return (
    <View>
      <Pressable onPress={press} style={st.pickerBtn}>
        <Text style={st.pickerText}>🕒 {formatTime(value)}</Text>
      </Pressable>
      {open && Platform.OS !== 'android' ? (
        <DateTimePicker value={date} mode="time" display="spinner" onChange={(_, d) => d && onChange(timeFromDate(d))} />
      ) : null}
    </View>
  );
}

function DateButton({ value, onChange }: { value: DateKey; onChange: (d: DateKey) => void }) {
  const [open, setOpen] = useState(false);
  const date = dateFromKey(value);
  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        onChange: (e, d) => e.type === 'set' && d && onChange(toDateKey(d)),
      });
    } else setOpen(!open);
  };
  return (
    <View>
      <Pressable onPress={press} style={st.pickerBtn}>
        <Text style={st.pickerText}>📅 {formatDateLong(value)}</Text>
      </Pressable>
      {open && Platform.OS !== 'android' ? (
        <DateTimePicker value={date} mode="date" display="inline" onChange={(_, d) => d && onChange(toDateKey(d))} />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  inlineText: { fontSize: 15, color: colors.text, marginBottom: 8 },
  small: { width: 70, textAlign: 'center', marginBottom: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16, marginRight: 10, marginBottom: 8 },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  remove: { color: colors.bad, fontSize: 14 },
  pickerBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, alignSelf: 'flex-start' },
  pickerText: { fontSize: 16, color: colors.text },
  preview: { backgroundColor: colors.primarySoft, color: colors.primary, padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 14, lineHeight: 20 },
});

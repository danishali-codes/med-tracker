import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { removeMedication, saveMedication } from '../../actions';
import { defaultShape, hasShape, lookOf, PILL_COLORS, PILL_SHAPES, PillArt } from '../../components/PillArt';
import { Button, Card, Chip, Field, Input, PressableScale, Select, Text } from '../../components/ui';
import { atTime, dateFromKey, formatDateLong, formatTime, timeFromDate, toDateKey, weekdayShort, type DateKey, type TimeOfDay } from '../../domain/dates';
import { daysOfSupply, describeDose, FORM_UNITS, formatAmount, parseAmount } from '../../domain/dose';
import { describeSchedule, isPausedOn, nextDueDate, pauseMed, resumeMed } from '../../domain/schedule';
import type { MedForm, Medication, PillShape, SchedulePattern } from '../../domain/types';
import * as repo from '../../db/repo';
import { medicineDetails, searchMedicines } from '../../drugs/online';
import type { NameHit, StrengthOption } from '../../drugs/rank';
import { makeStyles, MED_COLORS, useTheme } from '../../theme';

type Kind = SchedulePattern['kind'];

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'daily', label: 'Every day' },
  { kind: 'weekdays', label: 'Days of the week' },
  { kind: 'interval', label: 'Every few days / weeks' },
  { kind: 'cycle', label: 'On / off cycle' },
  { kind: 'monthly', label: 'Monthly' },
  { kind: 'asNeeded', label: 'As needed' },
];

const FORMS: MedForm[] = ['pill', 'capsule', 'liquid', 'injection', 'inhaler', 'drops', 'patch', 'cream', 'sachet', 'other'];
const SUGGESTED_TIMES = ['08:00', '20:00', '13:00', '22:00', '06:00', '17:00'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const num = (s: string, fallback: number) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Smallest step for the amount stepper: half tablets, half ml, whole everything else. */
const stepFor = (f: MedForm) => (f === 'pill' || f === 'liquid' ? 0.5 : 1);

export default function MedEditor() {
  const c = useTheme();
  const st = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useMemo(() => (id && id !== 'new' ? repo.getMed(id) : null), [id]);
  const today = toDateKey(new Date());

  const [name, setName] = useState(existing?.name ?? '');
  const [generic, setGeneric] = useState(existing?.generic ?? '');
  const [rxcui, setRxcui] = useState<string | null>(existing?.rxcui ?? null);
  const [strength, setStrength] = useState(existing?.strength ?? '');
  const [amount, setAmount] = useState(existing?.amount ?? 1);
  const [form, setForm] = useState<MedForm>(existing?.form ?? 'pill');
  const [color, setColor] = useState(existing?.color ?? MED_COLORS[repo.getMeds().length % MED_COLORS.length]);
  const [shape, setShape] = useState<PillShape | undefined>(existing?.shape);
  const [pillColor, setPillColor] = useState<string | undefined>(existing?.pillColor);
  const [pillColor2, setPillColor2] = useState<string | null>(existing?.pillColor2 ?? null);
  const look = lookOf({ form, shape, pillColor, pillColor2, color });
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
  const [stock, setStock] = useState(existing?.stock != null ? formatAmount(existing.stock, false) : '30');
  const [refillAt, setRefillAt] = useState(String(existing?.refillAt ?? 7));

  // ---- name search ----
  const [hits, setHits] = useState<NameHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [strengths, setStrengths] = useState<StrengthOption[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const picked = useRef(existing?.name ?? '');

  useEffect(() => {
    if (!nameFocused || name.trim() === picked.current || name.trim().length < 2) {
      setHits([]);
      return;
    }
    let live = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchMedicines(name)
        .then((h) => live && setHits(h))
        .finally(() => live && setSearching(false));
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, nameFocused]);

  const pick = async (h: NameHit) => {
    picked.current = h.name;
    setName(h.name);
    setHits([]);
    if (h.generic) setGeneric(h.generic);
    setLoadingDetails(true);
    const d = await medicineDetails(h.name, h.generic);
    setLoadingDetails(false);
    if (d.generic) setGeneric(d.generic);
    setRxcui(d.rxcui);
    setStrengths(d.strengths);
    // Use the most common form among the strengths offered.
    const forms = d.strengths.map((x) => x.form);
    const top = forms.sort((a, b) => forms.filter((f) => f === b).length - forms.filter((f) => f === a).length)[0];
    if (top && !existing) setForm(top);
  };

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
    strength: strength.trim(),
    amount,
    form,
    generic: generic.trim() || null,
    rxcui,
    color,
    shape: hasShape(form) ? look.shape : undefined,
    pillColor: look.color,
    pillColor2: hasShape(form) && look.shape === 'capsule' ? pillColor2 : null,
    notes: notes.trim() || undefined,
    schedule: {
      pattern: pattern(),
      times: kind === 'asNeeded' ? [] : [...new Set(times)].sort(),
      startDate,
      endDate,
    },
    stock: trackStock ? (parseAmount(stock) ?? 0) : null,
    refillAt: trackStock ? Math.max(0, parseInt(refillAt, 10) || 0) : null,
    pauses: existing?.pauses ?? [],
    archived: existing?.archived ?? false,
    archivedAt: existing?.archivedAt ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });

  const draft = build();
  const preview = (() => {
    const s = draft.schedule;
    const next = kind === 'asNeeded' ? null : nextDueDate(s, today);
    return `${describeSchedule(s)}${next ? ` · next ${next === today ? 'today' : formatDateLong(next)}` : ''}`;
  })();
  const supply = trackStock ? daysOfSupply(draft) : null;
  const u = FORM_UNITS[form];

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

  const paused = existing ? isPausedOn(existing, today) : false;
  const togglePause = async () => {
    if (!existing) return;
    await saveMedication(paused ? resumeMed(existing, today) : pauseMed(existing, today));
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete medication?', 'This removes it and its dose log. Your past streaks stay. Archive it instead if you want to keep its log.', [
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

  const step = stepFor(form);
  const changeAmount = (d: number) => setAmount((a) => Math.max(step, Math.round((a + d) * 100) / 100));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Edit medication' : 'New medication' }} />
      <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Name" hint={hits.length === 0 && !generic ? 'Start typing to search brand or generic names' : undefined} style={{ marginBottom: 0 }}>
            <View>
              <Input
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  // Typing a different name drops what the earlier pick filled in.
                  if (picked.current && t.trim() !== picked.current) {
                    picked.current = '';
                    setRxcui(null);
                    setGeneric('');
                    setStrengths([]);
                  }
                }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setTimeout(() => setNameFocused(false), 150)}
                placeholder="e.g. Panadol or metformin"
                autoFocus={!existing}
                autoCorrect={false}
              />
              {searching ? <ActivityIndicator style={st.spinner} color={c.primary} /> : null}
            </View>
            {hits.length > 0 ? (
              <View style={st.suggest}>
                {hits.map((h) => (
                  <Pressable key={h.name} onPress={() => pick(h)} style={({ pressed }) => [st.suggestRow, pressed && { backgroundColor: c.sunken }]}>
                    <Ionicons name="search" size={16} color={c.faint} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.suggestName}>{h.name}</Text>
                      {h.generic && h.generic.toLowerCase() !== h.name.toLowerCase() ? <Text style={st.suggestSub}>{h.generic}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Field>
          {generic || loadingDetails ? (
            <View style={st.genericRow}>
              <Ionicons name="flask-outline" size={16} color={c.primary} />
              {loadingDetails ? <ActivityIndicator size="small" color={c.primary} /> : <Text style={st.genericText}>Active ingredient: {generic}</Text>}
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={st.cardTitle}>Dose</Text>
          <Field label="Type">
            <Select
              title="Type"
              value={form}
              onChange={(f) => {
                setForm(f);
                if (!hasShape(f)) setShape(undefined);
                else if (!shape || (f === 'capsule') !== (shape === 'capsule')) setShape(defaultShape(f));
              }}
              options={FORMS.map((f) => ({
                value: f,
                label: FORM_UNITS[f].label,
                icon: <PillArt form={f} shape={defaultShape(f)} color={hasShape(f) ? '#FFFFFF' : color} size={28} />,
              }))}
            />
          </Field>
          <Field label={`Strength of one ${u.one}`} hint="Optional, e.g. 500 mg or 5 mg/ml">
            <Input value={strength} onChangeText={setStrength} placeholder="500 mg" autoCorrect={false} />
            {strengths.length > 0 ? (
              <View style={[st.wrap, { marginTop: 10 }]}>
                {strengths.map((o) => (
                  <Chip
                    key={`${o.strength}-${o.form}`}
                    label={o.label}
                    selected={strength === o.strength && form === o.form}
                    onPress={() => {
                      setStrength(o.strength);
                      setForm(o.form);
                    }}
                  />
                ))}
              </View>
            ) : null}
          </Field>
          <Field label="How much each time" style={{ marginBottom: 6 }}>
            <View style={st.stepper}>
              <PressableScale onPress={() => changeAmount(-step)} style={st.stepBtn} haptic accessibilityLabel="Less">
                <Ionicons name="remove" size={22} color={c.primary} />
              </PressableScale>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={st.stepValue}>{formatAmount(amount, form !== 'liquid')}</Text>
                <Text style={st.stepUnit}>{amount > 1 ? u.many : u.one}</Text>
              </View>
              <PressableScale onPress={() => changeAmount(step)} style={st.stepBtn} haptic accessibilityLabel="More">
                <Ionicons name="add" size={22} color={c.primary} />
              </PressableScale>
            </View>
          </Field>
          <Text style={st.preview}>Each dose: {describeDose(draft)}</Text>
        </Card>

        <Card>
          <Text style={st.cardTitle}>Schedule</Text>
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
                  <Chip key={d} label={weekdayShort(d)} selected={days.includes(d)} onPress={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])} />
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
                      <Ionicons name="close-circle" size={24} color={c.faint} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <Button title="Add another time" kind="secondary" small onPress={addTime} style={{ alignSelf: 'flex-start' }} />
            </Field>
          ) : null}

          <View style={st.inline}>
            <Field label="Starts" style={{ flex: 1 }}>
              <DateButton value={startDate} onChange={setStartDate} />
            </Field>
          </View>
          <Field label="Ends">
            <View style={st.inline}>
              <Switch value={endDate != null} onValueChange={(on) => setEndDate(on ? startDate : null)} trackColor={{ true: c.primary }} />
              {endDate ? <DateButton value={endDate} onChange={setEndDate} /> : <Text style={st.inlineText}>Ongoing</Text>}
            </View>
          </Field>
          <Text style={st.preview}>{preview}</Text>
        </Card>

        <Card>
          <View style={st.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>Refill reminder</Text>
              <Text style={st.hint}>Counts {u.many} as you take them</Text>
            </View>
            <Switch value={trackStock} onValueChange={setTrackStock} trackColor={{ true: c.primary }} />
          </View>
          {trackStock ? (
            <>
              <View style={[st.inline, { marginTop: 14 }]}>
                <Field label={`${u.many[0].toUpperCase()}${u.many.slice(1)} you have`} style={{ flex: 1 }}>
                  <Input value={stock} onChangeText={setStock} keyboardType="decimal-pad" />
                </Field>
                <Field label="Remind me at" style={{ flex: 1 }}>
                  <Input value={refillAt} onChangeText={setRefillAt} keyboardType="number-pad" />
                </Field>
              </View>
              <Text style={st.preview}>
                Each dose uses {describeDose({ ...draft, strength: '' })}.{supply != null ? ` That's about ${supply} ${supply === 1 ? 'day' : 'days'} of supply.` : ''}
              </Text>
            </>
          ) : null}
        </Card>

        {name.trim() ? (
          <PressableScale
            onPress={() => router.push({ pathname: '/interactions', params: { id: draft.id, name: draft.name, generic: draft.generic ?? '' } })}
            style={[st.interactions, { backgroundColor: c.primarySoft }]}
          >
            <Ionicons name="shield-checkmark" size={22} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[st.cardTitle, { color: c.primary, marginBottom: 0 }]}>Check interactions</Text>
              <Text style={st.hint}>With your other meds, alcohol and food</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.primary} />
          </PressableScale>
        ) : null}

        <Card>
          <Text style={st.cardTitle}>Look</Text>
          <View style={st.lookPreview}>
            <PillArt {...look} size={96} />
          </View>
          {hasShape(form) ? (
            <Field label="Shape">
              <View style={st.wrap}>
                {PILL_SHAPES.map((sh) => {
                  const on = look.shape === sh.id;
                  return (
                    <PressableScale key={sh.id} onPress={() => setShape(sh.id)} haptic style={[st.shapeTile, on && { borderColor: c.primary, backgroundColor: c.primarySoft }]} accessibilityLabel={sh.label}>
                      <PillArt form={form} shape={sh.id} color={look.color} color2={look.color2} size={40} />
                      <Text style={[st.shapeText, on && { color: c.primary }]}>{sh.label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </Field>
          ) : null}
          <Field label={hasShape(form) && look.shape === 'capsule' ? 'First colour' : 'Colour'}>
            <Swatches colors={PILL_COLORS} value={look.color} onChange={setPillColor} />
          </Field>
          {hasShape(form) && look.shape === 'capsule' ? (
            <Field label="Second colour">
              <Swatches colors={PILL_COLORS} value={look.color2 ?? look.color} onChange={setPillColor2} />
            </Field>
          ) : null}
        </Card>

        <Card>
          <Field label="Accent colour" hint="Used for this medicine's rings and tags in the app.">
            <View style={st.wrap}>
              {MED_COLORS.map((col) => (
                <PressableScale key={col} onPress={() => setColor(col)} haptic style={[st.swatch, { backgroundColor: col }, color === col && st.swatchOn]}>
                  {color === col ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                </PressableScale>
              ))}
            </View>
          </Field>
          <Field label="Notes" style={{ marginBottom: 0 }}>
            <Input value={notes} onChangeText={setNotes} placeholder="e.g. take with food" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
          </Field>
        </Card>

        <Button title="Save" onPress={save} />
        {existing && !existing.archived && kind !== 'asNeeded' ? (
          <Button
            title={paused ? 'Resume reminders' : 'Pause for now'}
            kind="secondary"
            onPress={togglePause}
            style={{ marginTop: 12 }}
            icon={<Ionicons name={paused ? 'play' : 'pause'} size={16} color={c.primary} />}
          />
        ) : null}
        {existing && !existing.archived && kind !== 'asNeeded' ? (
          <Text style={st.pauseHint}>
            {paused ? 'Paused: no reminders, and your streak is safe.' : 'Pausing stops reminders without breaking your streak, e.g. when your doctor says to stop for a while.'}
          </Text>
        ) : null}
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
  const c = useTheme();
  const st = useStyles();
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
      <PressableScale onPress={press} style={st.pickerBtn}>
        <Ionicons name="time-outline" size={18} color={c.primary} />
        <Text style={st.pickerText}>{formatTime(value)}</Text>
      </PressableScale>
      {open && Platform.OS !== 'android' ? (
        <DateTimePicker value={date} mode="time" display="spinner" onChange={(_, d) => d && onChange(timeFromDate(d))} />
      ) : null}
    </View>
  );
}

function DateButton({ value, onChange }: { value: DateKey; onChange: (d: DateKey) => void }) {
  const c = useTheme();
  const st = useStyles();
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
      <PressableScale onPress={press} style={st.pickerBtn}>
        <Ionicons name="calendar-outline" size={18} color={c.primary} />
        <Text style={st.pickerText}>{formatDateLong(value)}</Text>
      </PressableScale>
      {open && Platform.OS !== 'android' ? (
        <DateTimePicker value={date} mode="date" display="inline" onChange={(_, d) => d && onChange(toDateKey(d))} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { padding: 16, paddingBottom: 60 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: c.text, marginBottom: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  lookPreview: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.sunken, borderRadius: 22, paddingVertical: 18, marginBottom: 16 },
  shapeTile: { width: 76, alignItems: 'center', paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, marginRight: 8, marginBottom: 8 },
  shapeText: { fontSize: 12, fontWeight: '700', color: c.muted, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  inlineText: { fontSize: 15, color: c.text, fontWeight: '600' },
  small: { width: 76, textAlign: 'center', marginBottom: 8 },
  swatch: { width: 38, height: 38, borderRadius: 19, marginRight: 10, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: c.card, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: c.primarySoft,
    alignSelf: 'flex-start',
  },
  pickerText: { fontSize: 16, fontWeight: '800', color: c.primary },
  preview: { backgroundColor: c.sunken, color: c.muted, padding: 14, borderRadius: 16, marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  hint: { fontSize: 13, color: c.muted, fontWeight: '600' },
  spinner: { position: 'absolute', right: 14, top: 14 },
  suggest: { marginTop: 8, borderRadius: 18, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  suggestName: { fontSize: 15, fontWeight: '800', color: c.text },
  suggestSub: { fontSize: 12, fontWeight: '600', color: c.muted },
  genericRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: c.primarySoft, borderRadius: 14, padding: 10 },
  genericText: { fontSize: 13, fontWeight: '700', color: c.primary, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.sunken, borderRadius: 22, padding: 8 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 28, fontWeight: '900', color: c.text },
  stepUnit: { fontSize: 13, fontWeight: '700', color: c.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pauseHint: { fontSize: 12, color: c.muted, fontWeight: '600', textAlign: 'center', marginTop: 6, marginHorizontal: 12 },
  interactions: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 24, marginBottom: 14 },
}));

function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  const c = useTheme();
  const st = useStyles();
  return (
    <View style={st.wrap}>
      {colors.map((col) => {
        const on = value.toUpperCase() === col.toUpperCase();
        return (
          <PressableScale key={col} onPress={() => onChange(col)} haptic style={[st.swatch, { backgroundColor: col, borderWidth: 1, borderColor: c.border }, on && st.swatchOn]} accessibilityLabel={`Colour ${col}`}>
            {on ? <Ionicons name="checkmark" size={18} color={col === '#FFFFFF' || col === '#F3E9D2' || col === '#FBE37A' ? '#333' : '#fff'} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

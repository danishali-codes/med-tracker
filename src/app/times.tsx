import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { popup } from '../components/Popup';
import { PageScroll } from '../components/Screen';
import { DateButton, TimeButton } from '../components/Pickers';
import { Button, Card, Chip, Field, SectionTitle, Select, Text } from '../components/ui';
import { addDays, formatDateLong, formatTime, toDateKey } from '../domain/dates';
import { CITIES, METHOD_NAMES } from '../domain/prayer';
import { isRamadanOn, phoneTimeZone, ramadanTimes } from '../domain/schedule';
import type { PrayerMethod, RamadanSettings, Settings, TimeChange } from '../domain/types';
import * as repo from '../db/repo';
import { useMeds, useSettings } from '../hooks/useData';
import { rescheduleAll } from '../notifications/reminders';
import { makeStyles, useTheme } from '../theme';

/** Travel mode, Ramadan mode and temporary time changes. */
export default function TimesScreen() {
  const c = useTheme();
  const st = useStyles();
  const settings = useSettings();
  const meds = useMeds();
  const active = meds.filter((m) => !m.archived && m.schedule.pattern.kind !== 'asNeeded');
  const today = toDateKey(new Date());

  const update = (patch: Partial<Settings>) => {
    repo.saveSettings({ ...settings, ...patch });
    rescheduleAll().catch(() => {});
  };
  const r = settings.ramadan;
  const setRamadan = (patch: Partial<RamadanSettings>) => update({ ramadan: { ...r, ...patch } });
  const preview = ramadanTimes(r, isRamadanOn({ ...r, enabled: true }, today) ? today : r.from);
  const phoneZone = phoneTimeZone();

  return (
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionTitle>Travel</SectionTitle>
      <Card>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Keep home time</Text>
            <Text style={st.hint}>
              Off: reminders follow the phone's clock, so 8:00 AM stays 8:00 AM wherever you are. On: reminders stay on your home time, for meds that need to
              stay exactly 24 hours apart.
            </Text>
          </View>
          <Switch
            value={settings.travelMode}
            onValueChange={(on) => update({ travelMode: on, homeTimeZone: on ? (settings.homeTimeZone ?? phoneZone) : settings.homeTimeZone })}
            trackColor={{ true: c.primary }}
          />
        </View>
        {settings.travelMode ? (
          <View style={{ marginTop: 6 }}>
            <Text style={st.hint}>Home time zone: {settings.homeTimeZone ?? 'not set'}</Text>
            {phoneZone && phoneZone !== settings.homeTimeZone ? (
              <Button title={`Use ${phoneZone} as home`} kind="ghost" small onPress={() => update({ homeTimeZone: phoneZone })} style={{ alignSelf: 'flex-start' }} />
            ) : null}
          </View>
        ) : null}
      </Card>

      <SectionTitle>Ramadan</SectionTitle>
      <Card>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Ramadan times</Text>
            <Text style={st.hint}>Moves doses to suhoor and iftar between the dates below. One morning dose goes to suhoor, an evening dose to iftar, and twice-daily meds get both.</Text>
          </View>
          <Switch value={r.enabled} onValueChange={(on) => setRamadan({ enabled: on })} trackColor={{ true: c.primary }} />
        </View>
        {r.enabled ? (
          <>
            <View style={[st.inline, { marginTop: 10 }]}>
              <Field label="From" style={{ flex: 1 }}>
                <DateButton value={r.from} onChange={(from) => setRamadan({ from, to: from > r.to ? addDays(from, 29) : r.to })} />
              </Field>
              <Field label="To" style={{ flex: 1 }}>
                <DateButton value={r.to} onChange={(to) => setRamadan({ to })} />
              </Field>
            </View>
            <Field label="Times">
              <View style={st.wrap}>
                <Chip label="Set them myself" selected={r.mode === 'manual'} onPress={() => setRamadan({ mode: 'manual' })} />
                <Chip label="From my city" selected={r.mode === 'city'} onPress={() => setRamadan({ mode: 'city', cityId: r.cityId ?? 'dubai' })} />
              </View>
            </Field>
            {r.mode === 'manual' ? (
              <View style={st.inline}>
                <Field label="Suhoor dose" style={{ flex: 1 }}>
                  <TimeButton value={r.suhoor} onChange={(suhoor) => setRamadan({ suhoor })} />
                </Field>
                <Field label="Iftar dose" style={{ flex: 1 }}>
                  <TimeButton value={r.iftar} onChange={(iftar) => setRamadan({ iftar })} />
                </Field>
              </View>
            ) : (
              <>
                <Field label="City">
                  <Select
                    title="City"
                    value={r.cityId ?? 'dubai'}
                    onChange={(cityId) => setRamadan({ cityId, method: CITIES.find((x) => x.id === cityId)?.method ?? r.method })}
                    options={CITIES.map((x) => ({ value: x.id, label: `${x.name}, ${x.country}` }))}
                  />
                </Field>
                <Field label="Calculation">
                  <Select
                    title="Calculation"
                    value={r.method}
                    onChange={(method) => setRamadan({ method: method as PrayerMethod })}
                    options={(Object.keys(METHOD_NAMES) as PrayerMethod[]).map((m) => ({ value: m, label: METHOD_NAMES[m] }))}
                  />
                </Field>
                <Field label="Suhoor dose, before Fajr">
                  <View style={st.wrap}>
                    {[15, 30, 45, 60].map((m) => (
                      <Chip key={m} label={`${m} min`} selected={r.suhoorBeforeFajr === m} onPress={() => setRamadan({ suhoorBeforeFajr: m })} />
                    ))}
                  </View>
                </Field>
                <Field label="Iftar dose, after Maghrib">
                  <View style={st.wrap}>
                    {[0, 10, 20, 30].map((m) => (
                      <Chip key={m} label={m === 0 ? 'At Maghrib' : `${m} min`} selected={r.iftarAfterMaghrib === m} onPress={() => setRamadan({ iftarAfterMaghrib: m })} />
                    ))}
                  </View>
                </Field>
                <Text style={st.hint}>Worked out on the phone from the sun, no internet needed. Check against your local timetable; it can differ by a few minutes.</Text>
              </>
            )}
            <Text style={st.preview}>
              {isRamadanOn({ ...r, enabled: true }, today) ? 'Today' : formatDateLong(r.from)}: suhoor dose at {formatTime(preview.suhoor)}, iftar dose at{' '}
              {formatTime(preview.iftar)}
            </Text>
            <Field label="Medications that move" style={{ marginTop: 14, marginBottom: 0 }}>
              <View style={st.wrap}>
                <Chip label="All" selected={r.medIds == null} onPress={() => setRamadan({ medIds: null })} />
                {active.map((m) => {
                  const on = r.medIds?.includes(m.id) ?? false;
                  return (
                    <Chip
                      key={m.id}
                      label={m.name}
                      selected={on}
                      onPress={() => {
                        const cur = r.medIds ?? [];
                        const next = on ? cur.filter((x) => x !== m.id) : [...cur, m.id];
                        setRamadan({ medIds: next.length ? next : null });
                      }}
                    />
                  );
                })}
              </View>
            </Field>
          </>
        ) : null}
      </Card>

      <SectionTitle>Temporary changes</SectionTitle>
      <Card>
        <Text style={st.hint}>Move reminders for a few days, for one medication or all. They go back to normal by themselves.</Text>
        {settings.timeChanges.filter((x) => x.to >= today).length === 0 ? <Text style={[st.hint, { marginTop: 10 }]}>No changes planned.</Text> : null}
        {settings.timeChanges
          .filter((x) => x.to >= today)
          .map((ch) => (
            <ChangeRow
              key={ch.id}
              change={ch}
              medNames={active.map((m) => ({ id: m.id, name: m.name }))}
              onChange={(next) => update({ timeChanges: settings.timeChanges.map((x) => (x.id === ch.id ? next : x)) })}
              onRemove={() => update({ timeChanges: settings.timeChanges.filter((x) => x.id !== ch.id) })}
            />
          ))}
        <Button
          title="Add a change"
          kind="secondary"
          small
          icon={<Ionicons name="add" size={16} color={c.primary} />}
          onPress={() =>
            update({
              // Old changes that have ended are dropped when a new one is added.
              timeChanges: [
                ...settings.timeChanges.filter((x) => x.to >= today),
                { id: repo.newId(), from: today, to: addDays(today, 6), medIds: null, moveFrom: '08:00', moveTo: '09:00' },
              ],
            })
          }
          style={{ alignSelf: 'flex-start', marginTop: 12 }}
        />
      </Card>
    </PageScroll>
  );
}

function ChangeRow({
  change,
  medNames,
  onChange,
  onRemove,
}: {
  change: TimeChange;
  medNames: { id: string; name: string }[];
  onChange: (c: TimeChange) => void;
  onRemove: () => void;
}) {
  const c = useTheme();
  const st = useStyles();
  const [kind, setKind] = useState<'move' | 'shift'>(change.shiftMinutes ? 'shift' : 'move');
  const set = (patch: Partial<TimeChange>) => onChange({ ...change, ...patch });
  return (
    <View style={st.change}>
      <View style={st.inline}>
        <Field label="From" style={{ flex: 1 }}>
          <DateButton value={change.from} onChange={(from) => set({ from, to: from > change.to ? from : change.to })} />
        </Field>
        <Field label="To" style={{ flex: 1 }}>
          <DateButton value={change.to} onChange={(to) => set({ to })} />
        </Field>
      </View>
      <View style={st.wrap}>
        <Chip
          label="Move one time"
          selected={kind === 'move'}
          onPress={() => {
            setKind('move');
            set({ shiftMinutes: undefined, moveFrom: change.moveFrom ?? '08:00', moveTo: change.moveTo ?? '09:00' });
          }}
        />
        <Chip
          label="Shift all"
          selected={kind === 'shift'}
          onPress={() => {
            setKind('shift');
            set({ shiftMinutes: change.shiftMinutes ?? 60, moveFrom: undefined, moveTo: undefined });
          }}
        />
      </View>
      {kind === 'move' ? (
        <View style={[st.inline, { marginTop: 6 }]}>
          <Text style={st.inlineText}>Remind at</Text>
          <TimeButton value={change.moveTo ?? '09:00'} onChange={(moveTo) => set({ moveTo })} />
          <Text style={st.inlineText}>instead of</Text>
          <TimeButton value={change.moveFrom ?? '08:00'} onChange={(moveFrom) => set({ moveFrom })} />
        </View>
      ) : (
        <View style={[st.wrap, { marginTop: 6 }]}>
          {[-120, -60, -30, 30, 60, 120].map((m) => (
            <Chip key={m} label={`${m > 0 ? '+' : '−'}${Math.abs(m) >= 60 ? `${Math.abs(m) / 60} h` : `${Math.abs(m)} min`}`} selected={change.shiftMinutes === m} onPress={() => set({ shiftMinutes: m })} />
          ))}
        </View>
      )}
      <Text style={[st.label, { marginTop: 10, marginBottom: 6 }]}>For</Text>
      <View style={st.wrap}>
        <Chip label="All medications" selected={change.medIds == null} onPress={() => set({ medIds: null })} />
        {medNames.map((m) => {
          const on = change.medIds?.includes(m.id) ?? false;
          return (
            <Chip
              key={m.id}
              label={m.name}
              selected={on}
              onPress={() => {
                const cur = change.medIds ?? [];
                const next = on ? cur.filter((x) => x !== m.id) : [...cur, m.id];
                set({ medIds: next.length ? next : null });
              }}
            />
          );
        })}
      </View>
      <Pressable
        onPress={() => popup('Remove this change?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onRemove }])}
        style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Ionicons name="trash-outline" size={16} color={c.bad} />
        <Text style={{ color: c.bad, fontWeight: '800' }}>Remove</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  inlineText: { fontSize: 15, color: c.text, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { fontSize: 15, color: c.text, fontWeight: '800' },
  hint: { fontSize: 13, color: c.muted, marginTop: 2, fontWeight: '600', lineHeight: 18 },
  preview: { backgroundColor: c.sunken, color: c.muted, padding: 14, borderRadius: 16, marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  change: { borderWidth: 1.5, borderColor: c.border, borderRadius: 18, padding: 12, marginTop: 12 },
}));

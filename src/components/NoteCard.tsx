import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { DateKey } from '../domain/dates';
import { COMMON_SYMPTOMS, MOODS, type DayNote } from '../domain/types';
import * as repo from '../db/repo';
import { makeStyles, useTheme } from '../theme';
import { Card, Chip, Input, PressableScale, Text } from './ui';

const empty = (date: DateKey): DayNote => ({ date, mood: null, symptoms: [], text: '' });

/** Mood, symptoms and a few words for one day. Saved as you go. */
export function NoteCard({ date, title = 'How are you feeling?' }: { date: DateKey; title?: string }) {
  const c = useTheme();
  const s = useStyles();
  const [note, setNote] = useState<DayNote>(() => repo.getNote(date) ?? empty(date));
  const [open, setOpen] = useState(false);
  // While typing, the text box owns the note; saves from elsewhere (the other tab,
  // a mood tap) reload it otherwise, so a later tap never writes back stale data.
  const typing = useRef(false);
  useEffect(() => {
    const load = () => {
      if (!typing.current) setNote(repo.getNote(date) ?? empty(date));
    };
    load();
    return repo.subscribe(load);
  }, [date]);

  // Merge onto the latest saved note so only the field you touched changes.
  const save = (change: (n: DayNote) => DayNote) => {
    const next = change(repo.getNote(date) ?? empty(date));
    setNote(next);
    repo.saveNote(next);
  };
  const toggleSymptom = (sym: string) =>
    save((n) => ({ ...n, symptoms: n.symptoms.includes(sym) ? n.symptoms.filter((x) => x !== sym) : [...n.symptoms, sym] }));
  const extra = note.symptoms.filter((x) => !COMMON_SYMPTOMS.includes(x));

  return (
    <Card>
      <Text style={s.title}>{title}</Text>
      <View style={s.moods}>
        {MOODS.map((m) => {
          const on = note.mood === m.value;
          return (
            <PressableScale
              key={m.value}
              haptic
              onPress={() => save((n) => ({ ...n, mood: on ? null : m.value }))}
              style={[s.mood, on && { backgroundColor: c.primary, borderColor: c.primary }]}
              accessibilityLabel={`Mood: ${m.label}`}
            >
              <Text style={[s.moodNum, on && { color: c.onPrimary }]}>{m.value}</Text>
              <Text style={[s.moodLabel, on && { color: c.onPrimary }]}>{m.label}</Text>
            </PressableScale>
          );
        })}
      </View>
      {open || note.symptoms.length > 0 || note.text ? (
        <>
          <Text style={s.label}>Symptoms</Text>
          <View style={s.wrap}>
            {[...COMMON_SYMPTOMS, ...extra].map((sym) => (
              <Chip key={sym} label={sym} selected={note.symptoms.includes(sym)} onPress={() => toggleSymptom(sym)} />
            ))}
          </View>
          <Input
            value={note.text}
            onFocus={() => (typing.current = true)}
            onChangeText={(text) => setNote({ ...note, text })}
            onEndEditing={() => {
              typing.current = false;
              save((n) => ({ ...n, text: note.text }));
            }}
            placeholder="Anything else? Side effects, sleep, what you ate..."
            multiline
            style={{ minHeight: 64, textAlignVertical: 'top', marginTop: 6 }}
          />
        </>
      ) : (
        <PressableScale onPress={() => setOpen(true)} style={{ marginTop: 10 }}>
          <Text style={[s.label, { color: c.primary, marginBottom: 0 }]}>Add symptoms or a note</Text>
        </PressableScale>
      )}
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  title: { fontSize: 17, fontWeight: '900', color: c.text, marginBottom: 12 },
  moods: { flexDirection: 'row', gap: 6 },
  mood: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: c.border },
  moodNum: { fontSize: 18, fontWeight: '900', color: c.text },
  moodLabel: { fontSize: 11, fontWeight: '700', color: c.muted },
  label: { fontSize: 14, fontWeight: '800', color: c.text, marginTop: 14, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
}));

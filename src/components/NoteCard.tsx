import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { DateKey } from '../domain/dates';
import { COMMON_SYMPTOMS, MOODS, type DayNote } from '../domain/types';
import * as repo from '../db/repo';
import { makeStyles, useTheme } from '../theme';
import { Button, Card, Chip, Input, PressableScale, Text } from './ui';

const empty = (date: DateKey): DayNote => ({ date, mood: null, symptoms: [], text: '' });

const same = (a: DayNote, b: DayNote) =>
  a.mood === b.mood && a.text.trim() === b.text.trim() && a.symptoms.length === b.symptoms.length && a.symptoms.every((x) => b.symptoms.includes(x));

const isEmpty = (n: DayNote) => n.mood == null && n.symptoms.length === 0 && !n.text.trim();

/**
 * Mood, symptoms and a few words for one day. You fill it in, then press Save; once saved it
 * folds down to a short summary you can open again to change.
 */
export function NoteCard({ date, title = 'How are you feeling?' }: { date: DateKey; title?: string }) {
  const c = useTheme();
  const s = useStyles();
  const [saved, setSaved] = useState<DayNote>(() => repo.getNote(date) ?? empty(date));
  const [draft, setDraft] = useState<DayNote>(saved);
  const [editing, setEditing] = useState(() => isEmpty(saved));
  const [details, setDetails] = useState(false);

  const savedRef = useRef(saved);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // A save from elsewhere (the other tab) shows up here, unless you're halfway through a change.
  useEffect(() => {
    const first = repo.getNote(date) ?? empty(date);
    savedRef.current = first;
    setSaved(first);
    setDraft(first);
    setEditing(isEmpty(first));
    return repo.subscribe(() => {
      const next = repo.getNote(date) ?? empty(date);
      if (same(next, savedRef.current)) return;
      const untouched = same(draftRef.current, savedRef.current);
      savedRef.current = next;
      setSaved(next);
      if (untouched) setDraft(next);
    });
  }, [date]);

  const dirty = !same(draft, saved);
  const save = () => {
    const note = { ...draft, text: draft.text.trim() };
    savedRef.current = note;
    repo.saveNote(note);
    setSaved(note);
    setDraft(note);
    setEditing(isEmpty(note));
    setDetails(false);
  };
  const toggleSymptom = (sym: string) =>
    setDraft((n) => ({ ...n, symptoms: n.symptoms.includes(sym) ? n.symptoms.filter((x) => x !== sym) : [...n.symptoms, sym] }));
  const extra = draft.symptoms.filter((x) => !COMMON_SYMPTOMS.includes(x));

  if (!editing) {
    const mood = MOODS.find((m) => m.value === saved.mood);
    const bits = [saved.symptoms.join(', '), saved.text].filter(Boolean).join(' · ');
    return (
      <Card>
        <View style={s.savedRow}>
          <View style={[s.moodBadge, { backgroundColor: c.primarySoft }]}>
            {mood ? <Text style={[s.moodNum, { color: c.primary }]}>{mood.value}</Text> : <Ionicons name="create-outline" size={20} color={c.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.savedTitle}>{mood ? `Feeling ${mood.label.toLowerCase()}` : 'Note saved'}</Text>
            {bits ? (
              <Text style={s.savedText} numberOfLines={2}>
                {bits}
              </Text>
            ) : null}
          </View>
          <Ionicons name="checkmark-circle" size={22} color={c.good} accessibilityLabel="Saved" />
        </View>
        <View style={s.actions}>
          <Button title="Change" kind="secondary" small onPress={() => setEditing(true)} style={{ flexGrow: 1 }} />
          <Button title="Mood trend" kind="ghost" small onPress={() => router.push('/mood')} style={{ flexGrow: 1 }} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={s.title}>{title}</Text>
      <View style={s.moods}>
        {MOODS.map((m) => {
          const on = draft.mood === m.value;
          return (
            <PressableScale
              key={m.value}
              haptic
              onPress={() => setDraft((n) => ({ ...n, mood: on ? null : m.value }))}
              style={[s.mood, on && { backgroundColor: c.primary, borderColor: c.primary }]}
              accessibilityLabel={`Mood: ${m.label}`}
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.moodNum, on && { color: c.onPrimary }]}>{m.value}</Text>
              <Text style={[s.moodLabel, on && { color: c.onPrimary }]}>{m.label}</Text>
            </PressableScale>
          );
        })}
      </View>
      {details || draft.symptoms.length > 0 || draft.text ? (
        <>
          <Text style={s.label}>Symptoms</Text>
          <View style={s.wrap}>
            {[...COMMON_SYMPTOMS, ...extra].map((sym) => (
              <Chip key={sym} label={sym} selected={draft.symptoms.includes(sym)} onPress={() => toggleSymptom(sym)} />
            ))}
          </View>
          <Input
            value={draft.text}
            onChangeText={(text) => setDraft((n) => ({ ...n, text }))}
            placeholder="Anything else? Side effects, sleep, what you ate..."
            multiline
            style={{ minHeight: 64, textAlignVertical: 'top', marginTop: 6 }}
          />
        </>
      ) : (
        <PressableScale onPress={() => setDetails(true)} style={{ marginTop: 10 }}>
          <Text style={[s.label, { color: c.primary, marginBottom: 0, marginTop: 4 }]}>Add symptoms or a note</Text>
        </PressableScale>
      )}
      <View style={s.actions}>
        {!isEmpty(saved) ? (
          <Button
            title="Cancel"
            kind="secondary"
            small
            onPress={() => {
              setDraft(saved);
              setEditing(false);
            }}
            style={{ flexGrow: 1 }}
          />
        ) : null}
        <Button title="Save" small disabled={!dirty} onPress={save} style={{ flexGrow: 1 }} />
      </View>
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  moodBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  savedTitle: { fontSize: 16, fontWeight: '800', color: c.text },
  savedText: { fontSize: 14, color: c.muted, marginTop: 2, fontWeight: '600' },
}));

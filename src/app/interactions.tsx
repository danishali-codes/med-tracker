import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PageScroll } from '../components/Screen';
import { Card, FadeIn, SectionTitle, Text } from '../components/ui';
import type { InteractionKind, InteractionNote } from '../domain/interactions';
import type { Medication } from '../domain/types';
import * as repo from '../db/repo';
import { checkInteractions, type CheckResult } from '../drugs/check';
import { onlineAllowed } from '../drugs/online';
import { makeStyles, useTheme } from '../theme';

const SECTIONS: { kind: InteractionKind; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: 'medicine', title: 'Between your medicines', icon: 'medkit' },
  { kind: 'alcohol', title: 'Alcohol', icon: 'wine' },
  { kind: 'food', title: 'Food and drink', icon: 'restaurant' },
];

export default function InteractionsScreen() {
  const c = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ id?: string; name?: string; generic?: string }>();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meds = useMemo(() => {
    const list: Medication[] = repo.getMeds().filter((m) => !m.archived);
    if (params.id && params.name) {
      // The editor may be checking a med that isn't saved yet, or has unsaved changes.
      const draft = { ...(list.find((m) => m.id === params.id) ?? ({} as Medication)), id: params.id, name: params.name, generic: params.generic || null };
      return [...list.filter((m) => m.id !== params.id), draft as Medication];
    }
    return list;
  }, [params.id, params.name, params.generic]);

  useEffect(() => {
    let live = true;
    checkInteractions(meds, params.id ?? null)
      .then((r) => live && setResult(r))
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [meds, params.id]);

  const focusName = params.id ? params.name : null;
  const online = useMemo(() => onlineAllowed(), []);

  return (
    <PageScroll contentContainerStyle={s.container}>
      <Stack.Screen options={{ title: focusName ? `${focusName}` : 'Interactions' }} />
      <Card style={{ backgroundColor: c.warnSoft }}>
        <View style={s.noticeRow}>
          <Ionicons name="information-circle" size={24} color={c.warn} />
          <Text style={s.noticeTitle}>Not a complete list</Text>
        </View>
        <Text style={s.noticeText}>
          These notes come from a short list of well-known interactions and from official US drug labels. Many interactions aren't listed here, and
          brands sold in the UAE may differ. Always ask your doctor or pharmacist before you start, stop or combine medicines.
        </Text>
        <Text style={[s.noticeText, { marginTop: 8 }]}>
          {online
            ? 'Only the active ingredient names are sent to the US FDA to look this up. Nothing about you is sent. You can turn online search off in Settings > Privacy.'
            : 'Online search is off, so only the built-in list and labels already saved on this phone were checked. Nothing was sent. You can turn it on in Settings > Privacy to also read official US drug labels.'}
        </Text>
      </Card>

      {!result && !error ? (
        <View style={s.loading}>
          <ActivityIndicator color={c.primary} size="large" />
          <Text style={s.muted}>{online ? 'Reading drug labels…' : 'Checking the built-in list…'}</Text>
        </View>
      ) : null}
      {error ? <Text style={s.muted}>Something went wrong: {error}</Text> : null}

      {result
        ? SECTIONS.map((sec, i) => {
            const notes = result.notes.filter((n) => n.kind === sec.kind);
            if (sec.kind === 'medicine' && meds.length < 2) return null;
            return (
              <FadeIn key={sec.kind} delay={i * 80}>
                <SectionTitle>{sec.title}</SectionTitle>
                {notes.length === 0 ? (
                  <Card>
                    <Text style={s.muted}>Nothing found in these sources. That doesn't mean there's no interaction.</Text>
                  </Card>
                ) : (
                  notes.map((n, j) => <Note key={j} note={n} icon={sec.icon} />)
                )}
              </FadeIn>
            );
          })
        : null}

      {result?.missing.length ? (
        <Text style={[s.muted, { marginTop: 8 }]}>
          {online
            ? `No US label found for ${result.missing.join(', ')}. The phone may be offline, or the name isn't in the US database. Picking the medicine from the search list (so its active ingredient is filled in) helps.`
            : `No saved label for ${result.missing.join(', ')}, so only the built-in list was checked for it.`}
        </Text>
      ) : null}
    </PageScroll>
  );
}

function Note({ note, icon }: { note: InteractionNote; icon: keyof typeof Ionicons.glyphMap }) {
  const c = useTheme();
  const s = useStyles();
  const color = note.serious ? c.bad : c.primary;
  return (
    <Card style={note.serious ? { borderWidth: 1.5, borderColor: c.bad } : undefined}>
      <View style={s.noteHead}>
        <View style={[s.noteIcon, { backgroundColor: note.serious ? c.badSoft : c.primarySoft }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          {note.between ? <Text style={s.between}>{note.between.join(' + ')}</Text> : null}
          {note.serious ? <Text style={[s.serious, { color: c.bad }]}>Important</Text> : null}
        </View>
      </View>
      <Text style={s.noteText}>{note.text}</Text>
      <Text style={s.source}>{note.source}</Text>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  container: { padding: 16, paddingBottom: 60 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  noticeTitle: { fontSize: 17, fontWeight: '900', color: c.text },
  noticeText: { fontSize: 14, color: c.text, lineHeight: 20, fontWeight: '600' },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  muted: { fontSize: 14, color: c.muted, fontWeight: '600', lineHeight: 20 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  noteIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  between: { fontSize: 15, fontWeight: '900', color: c.text },
  serious: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  noteText: { fontSize: 15, color: c.text, lineHeight: 22, fontWeight: '600' },
  source: { fontSize: 12, color: c.muted, marginTop: 8, fontWeight: '700' },
}));

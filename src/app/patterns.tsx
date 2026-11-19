import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, FadeIn, SectionTitle, Text } from '../components/ui';
import { addDays } from '../domain/dates';
import { findPatterns, patternReadiness } from '../domain/insights';
import { indexLogs } from '../domain/schedule';
import * as repo from '../db/repo';
import { useMeds, useProgress } from '../hooks/useData';
import { makeStyles, useTheme } from '../theme';

const LOOKBACK_DAYS = 180;

/**
 * Lines up the mood and symptoms you note with how your doses went. Worked out on the
 * phone from your own notes; nothing is sent anywhere.
 */
export default function PatternsScreen() {
  const c = useTheme();
  const s = useStyles();
  const meds = useMeds();
  const { summaries, today } = useProgress();

  const { patterns, ready } = useMemo(() => {
    const from = addDays(today, -LOOKBACK_DAYS);
    const notes = repo.getNotes(from, addDays(today, -1));
    return {
      patterns: findPatterns({ summaries: summaries.filter((x) => x.date >= from && x.date < today), notes, meds, logs: indexLogs(repo.getLogs(from, today)) }),
      ready: patternReadiness(notes),
    };
  }, [summaries, meds, today]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.lead}>
        Compares the mood and symptoms you note each day with whether you took your doses, over the last 6 months. Worked out on this phone only.
      </Text>

      {patterns.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Ionicons name="pulse-outline" size={36} color={c.muted} />
          <Text style={[s.title, { textAlign: 'center', marginTop: 8 }]}>Nothing stands out yet</Text>
          <Text style={[s.body, { textAlign: 'center', marginTop: 4 }]}>
            {ready.moodDays < ready.needed
              ? `Note how you feel on the Today screen. Patterns need a few weeks of notes, including some days with a missed dose (${ready.moodDays} ${ready.moodDays === 1 ? 'day' : 'days'} noted so far).`
              : "Your mood and symptoms look about the same whether or not doses were missed. That's worth knowing too."}
          </Text>
        </Card>
      ) : (
        <>
          <SectionTitle>What lines up</SectionTitle>
          {patterns.map((p, i) => (
            <FadeIn key={p.id} delay={i * 40}>
              <Card style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.icon, { backgroundColor: c.primarySoft }]}>
                  <Ionicons name={p.id.startsWith('symptom') ? 'medkit-outline' : 'happy-outline'} size={20} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{p.title}</Text>
                  <Text style={[s.body, { marginTop: 4 }]}>{p.detail}</Text>
                </View>
              </Card>
            </FadeIn>
          ))}
        </>
      )}

      <Card style={{ backgroundColor: c.sunken, marginTop: 6 }}>
        <Text style={s.body}>
          These are coincidences in your own notes, not medical findings. A pattern can be chance, or have another cause. Talk to your doctor before changing
          how you take any medicine.
        </Text>
      </Card>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  lead: { fontSize: 14, color: c.muted, fontWeight: '600', lineHeight: 20, marginBottom: 12, marginHorizontal: 4 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: c.text },
  body: { fontSize: 14, color: c.muted, fontWeight: '600', lineHeight: 20 },
}));

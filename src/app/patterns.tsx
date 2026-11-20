import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Platform, View } from 'react-native';
import { PageScroll } from '../components/Screen';
import { Card, FadeIn, PressableScale, SectionTitle, Text } from '../components/ui';
import { addDays } from '../domain/dates';
import { findHealthPatterns, type HealthDay } from '../domain/health';
import { findPatterns, patternReadiness } from '../domain/insights';
import { indexLogs } from '../domain/schedule';
import * as repo from '../db/repo';
import { healthEnabled, readHealth } from '../health/connect';
import { useMeds, useProgress, useSettings } from '../hooks/useData';
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
  const settings = useSettings();

  // Steps, sleep and heart rate from Health Connect, only when that's turned on.
  const [health, setHealth] = useState<HealthDay[]>([]);
  useEffect(() => {
    if (!settings.healthConnect || !healthEnabled()) {
      setHealth([]);
      return;
    }
    let live = true;
    readHealth(addDays(today, -LOOKBACK_DAYS), addDays(today, -1)).then((d) => live && setHealth(d));
    return () => {
      live = false;
    };
  }, [settings.healthConnect, today]);

  const { patterns, ready } = useMemo(() => {
    const from = addDays(today, -LOOKBACK_DAYS);
    const notes = repo.getNotes(from, addDays(today, -1));
    const past = summaries.filter((x) => x.date >= from && x.date < today);
    return {
      patterns: [
        ...findPatterns({ summaries: past, notes, meds, logs: indexLogs(repo.getLogs(from, today)) }),
        ...findHealthPatterns({ summaries: past, notes, health }),
      ].sort((a, b) => b.weight - a.weight),
      ready: patternReadiness(notes),
    };
  }, [summaries, meds, today, health]);

  return (
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.lead}>
        Compares the mood and symptoms you note each day with whether you took your doses, over the last 6 months
        {settings.healthConnect ? ', along with your steps, sleep and heart rate from Health Connect' : ''}. Worked out on this phone only.
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
                  <Ionicons name={patternIcon(p.id)} size={20} color={c.primary} />
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

      {!settings.healthConnect && Platform.OS === 'android' ? (
        <PressableScale onPress={() => router.push('/health')} style={s.linkCard}>
          <Ionicons name="heart-outline" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Add sleep, steps and heart rate</Text>
            <Text style={s.body}>Bring them in from Samsung Health to see how they line up with your doses and mood.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.faint} />
        </PressableScale>
      ) : null}

      <Card style={{ backgroundColor: c.sunken, marginTop: 6 }}>
        <Text style={s.body}>
          These are coincidences in your own notes, not medical findings. A pattern can be chance, or have another cause. Talk to your doctor before changing
          how you take any medicine.
        </Text>
      </Card>
    </PageScroll>
  );
}

function patternIcon(id: string): keyof typeof Ionicons.glyphMap {
  if (id.startsWith('symptom')) return 'medkit-outline';
  if (id.startsWith('health-sleep')) return 'moon-outline';
  if (id.startsWith('health-steps')) return 'footsteps-outline';
  if (id.startsWith('health-resting')) return 'heart-outline';
  return 'happy-outline';
}

const useStyles = makeStyles((c) => ({
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 28, padding: 18, marginTop: 8, marginBottom: 8 },
  lead: { fontSize: 14, color: c.muted, fontWeight: '600', lineHeight: 20, marginBottom: 12, marginHorizontal: 4 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: c.text },
  body: { fontSize: 14, color: c.muted, fontWeight: '600', lineHeight: 20 },
}));

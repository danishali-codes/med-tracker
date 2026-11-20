import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { popup } from '../components/Popup';
import { PageScroll } from '../components/Screen';
import { ToggleRow } from '../components/ToggleRow';
import { Button, Card, FadeIn, PressableScale, SectionTitle, Text } from '../components/ui';
import { addDays, monthName, parseDateKey, weekdayOf, weekdayShort, type DateKey } from '../domain/dates';
import { formatSleep, formatSteps, HEALTH_KINDS, healthTable, type HealthDay, type HealthKind } from '../domain/health';
import { MOODS } from '../domain/types';
import * as repo from '../db/repo';
import {
  clearHealthCache,
  grantedKinds,
  healthStatus,
  installHealthConnect,
  openHealthConnect,
  readHealth,
  requestHealthAccess,
  type HealthStatus,
} from '../health/connect';
import { useProgress, useSettings } from '../hooks/useData';
import { makeStyles, useTheme } from '../theme';

const DAYS_SHOWN = 7;

/**
 * Steps, sleep and heart rate from Health Connect (where Samsung Health shares them), next to
 * your doses and mood. Off by default; read on the phone and never stored or sent.
 */
export default function HealthScreen() {
  const c = useTheme();
  const s = useStyles();
  const settings = useSettings();
  const { summaries, today } = useProgress();
  const on = settings.healthConnect;

  const [status, setStatus] = useState<HealthStatus>(() => healthStatus());
  const [granted, setGranted] = useState<HealthKind[] | null>(null);
  const [days, setDays] = useState<HealthDay[]>([]);

  const load = useCallback(() => {
    const st = healthStatus();
    setStatus(st);
    if (!repo.getSettings().healthConnect || st !== 'ready') {
      setGranted(null);
      setDays([]);
      return;
    }
    grantedKinds().then(setGranted);
    readHealth(addDays(today, -(DAYS_SHOWN - 1)), today).then(setDays);
  }, [today]);

  // Again when coming back from Health Connect or the Play Store.
  useFocusEffect(
    useCallback(() => {
      load();
      const sub = AppState.addEventListener('change', (a) => a === 'active' && load());
      return () => sub.remove();
    }, [load]),
  );

  const setOn = (v: boolean) => repo.saveSettings({ ...repo.getSettings(), healthConnect: v });

  const toggle = async (v: boolean) => {
    if (!v) {
      setOn(false);
      clearHealthCache();
      load();
      return;
    }
    const st = healthStatus();
    if (st === 'unavailable') {
      popup('Not available on this phone', 'Health Connect needs Android 8 or newer.');
      return;
    }
    if (st === 'needsInstall') {
      popup('Get Health Connect first', 'Samsung Health shares your steps, sleep and heart rate through the Health Connect app from Google. Install or update it, then come back here.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Play Store', onPress: installHealthConnect },
      ]);
      return;
    }
    setOn(true);
    try {
      const kinds = await requestHealthAccess();
      setGranted(kinds);
      if (kinds.length === 0) {
        popup('Nothing allowed yet', 'Sabr can only read what you allow in Health Connect. Tap "Choose what Sabr reads" whenever you want to change it.');
      }
    } catch {
      // The screen couldn't open; the buttons below can try again.
    }
    load();
  };

  const rows = useMemo(
    () => healthTable({ today, days: DAYS_SHOWN, health: days, summaries, notes: repo.getNotes(addDays(today, -(DAYS_SHOWN - 1)), today) }),
    [today, days, summaries],
  );

  return (
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.lead}>
        See your steps, sleep and heart rate next to your doses and mood. Sabr reads them from Health Connect, where Samsung Health and your Galaxy Watch
        share them. Read on this phone only: nothing is saved by Sabr or sent anywhere, and Sabr never writes to your health data.
      </Text>

      <Card>
        <ToggleRow
          label="Read health data"
          hint={
            on
              ? 'On. Health Connect decides what Sabr can see, and you can take it back there at any time.'
              : "Off. Sabr doesn't read anything from Health Connect."
          }
          value={on && status === 'ready'}
          onChange={toggle}
        />
      </Card>

      {on && status === 'ready' ? (
        <>
          <SectionTitle>What Sabr can read</SectionTitle>
          <Card>
            {HEALTH_KINDS.map((k) => {
              const ok = granted?.includes(k.kind) ?? false;
              return (
                <View key={k.kind} style={s.row}>
                  <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ok ? c.good : c.faint} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>{k.label}</Text>
                    <Text style={s.hint}>{ok ? k.hint : 'Not allowed'}</Text>
                  </View>
                </View>
              );
            })}
            <View style={s.buttons}>
              <Button
                title="Choose what Sabr reads"
                small
                onPress={() =>
                  requestHealthAccess()
                    .then(setGranted)
                    .then(load)
                    .catch(() => openHealthConnect())
                }
                style={{ flexGrow: 1 }}
              />
              <Button title="Open Health Connect" small kind="secondary" onPress={openHealthConnect} style={{ flexGrow: 1 }} />
            </View>
          </Card>

          <SectionTitle>Last 7 days</SectionTitle>
          {days.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
              <Ionicons name="watch-outline" size={32} color={c.muted} />
              <Text style={[s.label, { textAlign: 'center', marginTop: 8 }]}>No health data yet</Text>
              <Text style={[s.hint, { textAlign: 'center' }]}>
                If you use Samsung Health, let it share with Health Connect (see below). New data shows up here a few minutes after it syncs.
              </Text>
            </Card>
          ) : (
            rows.map((r, i) => (
              <FadeIn key={r.date} delay={i * 30}>
                <Card style={{ paddingVertical: 12 }}>
                  <View style={s.dayHead}>
                    <Text style={[s.label, { flex: 1 }]}>{dayLabel(r.date, today)}</Text>
                    {r.summary && r.summary.scheduled > 0 ? (
                      <Text style={[s.hint, { color: r.summary.status === 'complete' ? c.good : c.muted }]}>
                        {r.summary.taken} of {r.summary.scheduled} doses
                      </Text>
                    ) : null}
                  </View>
                  <View style={s.stats}>
                    <Stat icon="footsteps-outline" text={r.health?.steps != null ? `${formatSteps(r.health.steps)} steps` : null} />
                    <Stat icon="moon-outline" text={r.health?.sleepMin ? `${formatSleep(r.health.sleepMin)} sleep` : null} />
                    <Stat
                      icon="heart-outline"
                      text={
                        r.health?.restingHr != null
                          ? `${Math.round(r.health.restingHr)} bpm resting`
                          : r.health?.hrAvg != null
                            ? `${Math.round(r.health.hrAvg)} bpm average`
                            : null
                      }
                    />
                    <Stat icon="happy-outline" text={r.mood != null ? `Mood: ${MOODS.find((m) => m.value === r.mood)?.label}` : null} />
                  </View>
                </Card>
              </FadeIn>
            ))
          )}

          <PressableScale onPress={() => router.push('/patterns')} style={s.linkCard}>
            <Ionicons name="pulse-outline" size={22} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Patterns</Text>
              <Text style={s.hint}>How your sleep, steps and heart rate line up with your doses and mood</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.faint} />
          </PressableScale>
        </>
      ) : null}

      {status === 'needsInstall' ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={s.label}>Health Connect is needed</Text>
          <Text style={s.hint}>It's a free app from Google that keeps health data on your phone and lets you choose which apps can read it.</Text>
          <Button title="Get Health Connect" small onPress={installHealthConnect} style={{ marginTop: 10 }} />
        </Card>
      ) : null}

      {status !== 'unavailable' ? (
        <>
          <SectionTitle>From Samsung Health</SectionTitle>
          <Card>
            <Text style={s.body}>
              Samsung Health has to share with Health Connect first. In Samsung Health, open the menu, then Settings, then Health Connect, and allow steps,
              sleep and heart rate. Data from your Galaxy Watch reaches Samsung Health first, so it comes through too.
            </Text>
          </Card>
        </>
      ) : (
        <Card style={{ marginTop: 14 }}>
          <Text style={s.body}>Health Connect isn't available on this device.</Text>
        </Card>
      )}

      <Card style={{ backgroundColor: c.sunken, marginTop: 6 }}>
        <Text style={s.body}>
          Health data is shown for your own interest, not as medical advice. Sabr reads it again each time you open this page or Patterns and doesn't keep a
          copy, so it isn't in backups, reports or anything shared.
        </Text>
      </Card>
    </PageScroll>
  );
}

function Stat({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string | null }) {
  const c = useTheme();
  const s = useStyles();
  if (!text) return null;
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={15} color={c.muted} />
      <Text style={s.statText}>{text}</Text>
    </View>
  );
}

function dayLabel(date: DateKey, today: DateKey): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  const { m, d } = parseDateKey(date);
  return `${weekdayShort(weekdayOf(date))} ${d} ${monthName(m)}`;
}

const useStyles = makeStyles((c) => ({
  lead: { fontSize: 14, color: c.muted, fontWeight: '600', lineHeight: 20, marginBottom: 12, marginHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  label: { fontSize: 15, color: c.text, fontWeight: '800' },
  hint: { fontSize: 13, color: c.muted, marginTop: 2, fontWeight: '600', lineHeight: 18 },
  body: { fontSize: 14, color: c.muted, fontWeight: '600', lineHeight: 20 },
  dayHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 6 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13, color: c.text, fontWeight: '700' },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 28, padding: 18, marginTop: 14 },
}));

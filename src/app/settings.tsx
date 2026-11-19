import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import * as Application from 'expo-application';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';
import { Button, Card, Chip, SectionTitle, Text } from '../components/ui';
import { toDateKey } from '../domain/dates';
import type { Settings } from '../domain/types';
import * as repo from '../db/repo';
import { useSettings } from '../hooks/useData';
import {
  getPermissionState,
  openAppSettings,
  openBatterySettings,
  requestExactAlarms,
  requestNotificationPermission,
  type PermissionState,
} from '../notifications/permissions';
import { rescheduleAll, resetNotificationSetup, sendTestReminder } from '../notifications/reminders';
import { makeStyles, useTheme } from '../theme';

export default function SettingsScreen() {
  const st = useStyles();
  const settings = useSettings();
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const refresh = useCallback(() => {
    getPermissionState().then(setPerm).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);

  const update = (patch: Partial<Settings>) => {
    repo.saveSettings({ ...settings, ...patch });
    if (patch.snoozeMinutes) resetNotificationSetup();
    rescheduleAll().catch(() => {});
  };

  const exportBackup = async () => {
    try {
      const file = new File(Paths.cache, `med-tracker-backup-${toDateKey(new Date())}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(repo.exportAll());
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your backup' });
    } catch (e) {
      Alert.alert('Backup failed', String(e));
    }
  };

  const importBackup = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
      if (picked.canceled) return;
      const chosen = picked.result;
      const text = await chosen.text();
      Alert.alert('Restore backup?', 'This replaces everything in the app with the backup.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            try {
              repo.importAll(text);
              rescheduleAll().catch(() => {});
              Alert.alert('Restored', 'Your backup has been restored.');
            } catch (e) {
              Alert.alert('Could not restore', String(e instanceof Error ? e.message : e));
            }
          },
        },
      ]);
    } catch (e) {
      if (String(e).toLowerCase().includes('cancel')) return;
      Alert.alert('Could not open file', String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionTitle>Look and feel</SectionTitle>
      <Card>
        <Text style={[st.label, { marginBottom: 8 }]}>Appearance</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(
            [
              ['system', 'Match phone'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ] as const
          ).map(([v, label]) => (
            <Chip key={v} label={label} selected={settings.appearance === v} onPress={() => update({ appearance: v })} />
          ))}
        </View>
        <ToggleRow
          label="True black in dark mode"
          hint="Pure black backgrounds. Looks great and saves battery on most Samsung screens."
          value={settings.trueBlack}
          onChange={(v) => update({ trueBlack: v })}
        />
        <ToggleRow label="Confetti when the day is done" value={settings.celebrate} onChange={(v) => update({ celebrate: v })} />
      </Card>

      <SectionTitle>Make reminders reliable</SectionTitle>
      <Card>
        <PermRow
          label="Notifications"
          ok={perm?.notifications}
          action={() => requestNotificationPermission().then(refresh)}
        />
        {Platform.OS === 'android' ? (
          <>
            <PermRow label="Alarms & reminders (exact timing)" ok={perm?.exactAlarms} action={() => requestExactAlarms().then(refresh)} />
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Battery: allow background use</Text>
                <Text style={st.hint}>Samsung phones may put the app to sleep. Choose "Allow" or "Unrestricted".</Text>
              </View>
              <Button title="Open" small kind="secondary" onPress={openBatterySettings} />
            </View>
          </>
        ) : null}
        <Button title="Send a test reminder in 10 seconds" kind="secondary" onPress={() => sendTestReminder().catch((e) => Alert.alert('Error', String(e)))} style={{ marginTop: 8 }} />
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card>
        {Platform.OS === 'android' ? (
          <ToggleRow
            label="Alarm-style reminders"
            hint="Rings exactly on time, even in battery saver. Shows a small alarm icon in the status bar."
            value={settings.alarmStyle}
            onChange={(v) => update({ alarmStyle: v })}
          />
        ) : null}
        <ToggleRow
          label="Keep reminding until I answer"
          hint="Repeats the reminder until you tap Taken, Snooze or Skip."
          value={settings.nagEnabled}
          onChange={(v) => update({ nagEnabled: v })}
        />
        {settings.nagEnabled ? (
          <>
            <Options label="Repeat every" value={settings.nagEveryMinutes} options={[5, 10, 15, 30]} suffix="min" onChange={(v) => update({ nagEveryMinutes: v })} />
            <Options label="Up to" value={settings.nagCount} options={[1, 2, 3, 5, 8]} suffix="times" onChange={(v) => update({ nagCount: v })} />
          </>
        ) : null}
        <Options label="Snooze for" value={settings.snoozeMinutes} options={[5, 10, 15, 30, 60]} suffix="min" onChange={(v) => update({ snoozeMinutes: v })} />
        <Options
          label="Counts as on time within"
          value={settings.onTimeWindowMinutes}
          options={[30, 60, 120, 180]}
          suffix="min"
          onChange={(v) => update({ onTimeWindowMinutes: v })}
        />
        <Text style={st.hint}>Late doses still count for your streak. Only doses never taken that day break it.</Text>
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card>
        <Text style={st.hint}>Everything stays on this phone. Export a backup now and then so you don't lose your history if you change phones.</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
          <Button title="Export backup" kind="secondary" onPress={exportBackup} style={{ flex: 1 }} />
          <Button title="Restore" kind="secondary" onPress={importBackup} style={{ flex: 1 }} />
        </View>
      </Card>

      {Platform.OS === 'android' ? (
        <>
          <SectionTitle>Home screen widget</SectionTitle>
          <Card>
            <Text style={st.hint}>
              Long-press your home screen, tap Widgets, and find Sabr. It shows today's progress and your next dose, and you can mark the next dose as
              taken right from it.
            </Text>
          </Card>
          <SectionTitle>Smartwatch</SectionTitle>
          <Card>
            <Text style={st.hint}>
              Reminders show on your watch with the Taken, Snooze and Skip buttons once the watch is allowed to show this app. On a Galaxy Watch, open the
              Galaxy Wearable app, go to Watch settings, then Notifications, then App notifications, and turn on Sabr. The watch only buzzes while
              the phone screen is off.
            </Text>
          </Card>
        </>
      ) : null}

      <Button title="Open system app settings" kind="ghost" onPress={openAppSettings} />
      <Text style={[st.hint, { textAlign: 'center', marginTop: 8 }]}>
        Sabr {Application.nativeApplicationVersion ?? ''} ({Application.nativeBuildVersion ?? ''})
      </Text>
    </ScrollView>
  );
}

function PermRow({ label, ok, action }: { label: string; ok?: boolean; action: () => void }) {
  const c = useTheme();
  const st = useStyles();
  return (
    <View style={st.row}>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle-outline'} size={20} color={ok ? c.good : c.warn} style={{ marginRight: 8 }} />
      <Text style={[st.label, { flex: 1 }]}>{label}</Text>
      {ok ? <Text style={{ color: c.good, fontWeight: '800' }}>On</Text> : <Button title="Allow" small onPress={action} />}
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useTheme();
  const st = useStyles();
  return (
    <View style={st.row}>
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{label}</Text>
        {hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary }} />
    </View>
  );
}

function Options({ label, value, options, suffix, onChange }: { label: string; value: number; options: number[]; suffix: string; onChange: (v: number) => void }) {
  const st = useStyles();
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={[st.label, { marginBottom: 6 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {options.map((o) => (
          <Chip key={o} label={`${o} ${suffix}`} selected={value === o} onPress={() => onChange(o)} />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  label: { fontSize: 15, color: c.text, fontWeight: '800' },
  hint: { fontSize: 13, color: c.muted, marginTop: 2, fontWeight: '600', lineHeight: 18 },
}));

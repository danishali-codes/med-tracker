import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { TimeButton } from '../../components/Pickers';
import { popup } from '../../components/Popup';
import { Button, Text } from '../../components/ui';
import {
  getPermissionState,
  openAppSettings,
  openBatterySettings,
  requestExactAlarms,
  requestNotificationPermission,
  type PermissionState,
} from '../../notifications/permissions';
import { sendTestReminder } from '../../notifications/reminders';
import { useTheme } from '../../theme';
import { choice, toggle, useSettingStyles } from '../rows';
import type { SettingItem, SettingsGroup } from '../types';

function usePermissions() {
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const refresh = useCallback(() => {
    getPermissionState().then(setPerm).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);
  return [perm, refresh] as const;
}

function PermRow({ label, hint, ok, action, actionTitle = 'Allow' }: { label: string; hint?: string; ok?: boolean; action: () => void; actionTitle?: string }) {
  const c = useTheme();
  const st = useSettingStyles();
  return (
    <View style={st.row}>
      {ok !== undefined ? (
        <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle-outline'} size={20} color={ok ? c.good : c.warn} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{label}</Text>
        {hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
      {ok ? <Text style={{ color: c.good, fontWeight: '800' }}>On</Text> : <Button title={actionTitle} small kind={ok === undefined ? 'secondary' : 'primary'} onPress={action} />}
    </View>
  );
}

const reliable: SettingItem[] = [
  {
    id: 'permNotifications',
    title: 'Notifications',
    hint: 'Allow Sabr to show reminders.',
    keywords: ['permission', 'allow', 'not ringing', 'no reminders'],
    Component: function Notif() {
      const [perm, refresh] = usePermissions();
      return <PermRow label="Notifications" ok={perm?.notifications} action={() => requestNotificationPermission().then(refresh)} />;
    },
  },
  {
    id: 'permExactAlarms',
    title: 'Alarms and reminders (exact timing)',
    hint: 'Lets reminders ring at the exact minute.',
    keywords: ['permission', 'exact', 'late reminders', 'delayed'],
    androidOnly: true,
    Component: function Exact() {
      const [perm, refresh] = usePermissions();
      return <PermRow label="Alarms and reminders (exact timing)" ok={perm?.exactAlarms} action={() => requestExactAlarms().then(refresh)} />;
    },
  },
  {
    id: 'permBattery',
    title: 'Battery: allow background use',
    hint: 'Samsung phones may put the app to sleep. Choose "Allow" or "Unrestricted".',
    keywords: ['battery', 'sleep', 'unrestricted', 'optimisation', 'optimization', 'samsung', 'background'],
    androidOnly: true,
    Component: () => <PermRow label="Battery: allow background use" hint='Samsung phones may put the app to sleep. Choose "Allow" or "Unrestricted".' action={openBatterySettings} actionTitle="Open" />,
  },
  {
    id: 'testReminder',
    title: 'Send a test reminder',
    hint: 'A reminder in 10 seconds, to check sound and buttons.',
    keywords: ['test', 'try', 'check', 'sound'],
    Component: () => (
      <Button
        title="Send a test reminder in 10 seconds"
        kind="secondary"
        onPress={() => sendTestReminder().catch((e) => popup('Could not send it', String(e)))}
        style={{ marginTop: 8 }}
      />
    ),
  },
  {
    id: 'systemAppSettings',
    title: 'Open system app settings',
    hint: "Android's own page for Sabr: permissions, storage and notification channels.",
    keywords: ['android', 'system', 'permissions', 'storage', 'channels', 'sound'],
    advanced: true,
    Component: () => <Button title="Open system app settings" kind="ghost" onPress={openAppSettings} />,
  },
];

const behaviour: SettingItem[] = [
  toggle({
    id: 'alarmStyle',
    title: 'Alarm-style reminders',
    hint: 'Rings exactly on time, even in battery saver. Shows a small alarm icon in the status bar.',
    keywords: ['alarm', 'exact', 'battery saver', 'doze'],
    androidOnly: true,
    advanced: true,
    get: (s) => s.alarmStyle,
    set: (alarmStyle) => ({ alarmStyle }),
  }),
  toggle({
    id: 'nagEnabled',
    title: 'Keep reminding until I answer',
    hint: 'Repeats the reminder until you tap Taken, Snooze or Skip.',
    keywords: ['repeat', 'nag', 'again', 'persistent', 'follow up'],
    get: (s) => s.nagEnabled,
    set: (nagEnabled) => ({ nagEnabled }),
  }),
  choice({
    id: 'nagEveryMinutes',
    title: 'Repeat every',
    hint: 'How long between repeat reminders.',
    keywords: ['nag', 'interval', 'repeat'],
    advanced: true,
    visible: (s) => s.nagEnabled,
    options: [5, 10, 15, 30],
    suffix: 'min',
    get: (s) => s.nagEveryMinutes,
    set: (nagEveryMinutes) => ({ nagEveryMinutes }),
  }),
  choice({
    id: 'nagCount',
    title: 'Repeat up to',
    hint: 'How many repeat reminders at most.',
    keywords: ['nag', 'times', 'repeat'],
    advanced: true,
    visible: (s) => s.nagEnabled,
    options: [1, 2, 3, 5, 8],
    suffix: 'times',
    get: (s) => s.nagCount,
    set: (nagCount) => ({ nagCount }),
  }),
  toggle({
    id: 'nagEscalate',
    title: "Remind more often if I don't answer",
    hint: 'Each repeat comes a bit sooner than the last, down to every 5 minutes.',
    keywords: ['escalate', 'nag', 'sooner'],
    advanced: true,
    visible: (s) => s.nagEnabled,
    get: (s) => s.nagEscalate,
    set: (nagEscalate) => ({ nagEscalate }),
  }),
  toggle({
    id: 'quietHours',
    title: 'Quiet hours',
    hint: "No repeat reminders at night. A dose that's due still gets its first reminder.",
    keywords: ['night', 'sleep', 'do not disturb', 'silent'],
    get: (s) => s.quietHours.enabled,
    set: (enabled, s) => ({ quietHours: { ...s.quietHours, enabled } }),
    after: ({ settings, update }) =>
      settings.quietHours.enabled ? (
        <QuietTimes from={settings.quietHours.from} to={settings.quietHours.to} onChange={(p) => update({ quietHours: { ...settings.quietHours, ...p } })} />
      ) : null,
  }),
  toggle({
    id: 'missedNotice',
    title: 'Evening check',
    hint: "One last notice listing anything from earlier in the day that isn't logged yet.",
    keywords: ['missed', 'forgot', 'end of day', 'summary', 'night'],
    get: (s) => s.missedNotice,
    set: (missedNotice) => ({ missedNotice }),
    after: ({ settings, update }) =>
      settings.missedNotice ? (
        <View style={{ marginBottom: 6 }}>
          <TimeButton value={settings.missedNoticeAt} onChange={(missedNoticeAt) => update({ missedNoticeAt })} />
        </View>
      ) : null,
  }),
  choice({
    id: 'snoozeMinutes',
    title: 'Snooze for',
    hint: 'How long Snooze waits before reminding again.',
    keywords: ['snooze', 'later', 'delay'],
    advanced: true,
    options: [5, 10, 15, 30, 60],
    suffix: 'min',
    get: (s) => s.snoozeMinutes,
    set: (snoozeMinutes) => ({ snoozeMinutes }),
  }),
];

function QuietTimes({ from, to, onChange }: { from: string; to: string; onChange: (p: { from?: string; to?: string }) => void }) {
  const st = useSettingStyles();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <TimeButton value={from} onChange={(f) => onChange({ from: f })} />
      <Text style={st.label}>to</Text>
      <TimeButton value={to} onChange={(t) => onChange({ to: t })} />
    </View>
  );
}

export const remindersGroup: SettingsGroup = {
  id: 'reminders',
  title: 'Reminders',
  icon: 'notifications-outline',
  blurb: 'Permissions, repeats, quiet hours, snooze',
  summary: (s) => [s.nagEnabled ? 'Repeats on' : null, s.quietHours.enabled ? 'Quiet hours on' : null, s.missedNotice ? 'Evening check on' : null].filter(Boolean).join(' · ') || null,
  sections: [
    { title: 'Make reminders reliable', items: reliable },
    { title: 'How reminders behave', items: behaviour },
  ],
};

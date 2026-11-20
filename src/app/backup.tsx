import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { popup } from '../components/Popup';
import { PageScroll } from '../components/Screen';
import {
  autoBackupIfDue,
  hasAutoBackupPassword,
  lastAutoBackup,
  needsPassword,
  pickBackupFolder,
  restoreBackup,
  runAutoBackup,
  setAutoBackupPassword,
  shareBackup,
} from '../backup/backup';
import { ToggleRow, useRowStyles } from '../components/ToggleRow';
import { Button, Card, Chip, Field, Input, SectionTitle, Text } from '../components/ui';
import type { AutoBackupSettings } from '../domain/types';
import * as repo from '../db/repo';
import { useDbVersion, useSettings } from '../hooks/useData';
import { rescheduleAll } from '../notifications/reminders';
import { useTheme } from '../theme';

/** Locking a backup takes a moment on a phone; let the spinner draw first. */
const afterPaint = <T,>(fn: () => Promise<T> | T) =>
  new Promise<T>((resolve, reject) => requestAnimationFrame(() => setTimeout(() => Promise.resolve().then(fn).then(resolve, reject), 30)));

function when(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export default function BackupScreen() {
  const c = useTheme();
  const st = useRowStyles();
  const settings = useSettings();
  useDbVersion();
  const auto = settings.autoBackup;
  const [busy, setBusy] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pending, setPending] = useState<string | null>(null); // a locked file waiting for its password
  const [restorePw, setRestorePw] = useState('');
  const [autoPwSet, setAutoPwSet] = useState(false);
  const [autoPw, setAutoPw] = useState('');

  useEffect(() => {
    hasAutoBackupPassword().then(setAutoPwSet).catch(() => {});
  }, []);

  const saveAuto = (patch: Partial<AutoBackupSettings>) => repo.saveSettings({ ...settings, autoBackup: { ...auto, ...patch } });

  const exportNow = async () => {
    if (pw && pw !== pw2) return popup('Passwords differ', 'Type the same password twice.');
    if (!pw) {
      const go = await new Promise<boolean>((resolve) =>
        popup('Save without a password?', 'Anyone who gets the file can read your medicines and history. A password is safer, especially for Google Drive.', [
          { text: 'Add a password', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Save without', onPress: () => resolve(true) },
        ]),
      );
      if (!go) return;
    }
    setBusy('export');
    try {
      await afterPaint(() => shareBackup(pw || null));
    } catch (e) {
      popup('Backup failed', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const confirmRestore = (text: string, password: string | null) => {
    popup('Restore this backup?', 'This replaces everything in the app with the backup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        style: 'destructive',
        onPress: async () => {
          setBusy('restore');
          try {
            await afterPaint(() => restoreBackup(text, password));
            setPending(null);
            setRestorePw('');
            rescheduleAll().catch(() => {});
            popup('Restored', 'Your backup has been restored.');
          } catch (e) {
            popup('Could not restore', String(e instanceof Error ? e.message : e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const pickRestore = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['*/*'] });
      if (picked.canceled) return;
      const text = await picked.result.text();
      if (needsPassword(text)) {
        setPending(text);
        setRestorePw('');
      } else confirmRestore(text, null);
    } catch (e) {
      if (String(e).toLowerCase().includes('cancel')) return;
      popup('Could not open the file', String(e));
    }
  };

  const chooseFolder = async () => {
    try {
      const f = await pickBackupFolder();
      if (f) saveAuto({ folderUri: f.uri, folderName: f.name });
    } catch (e) {
      popup('Could not use that folder', String(e instanceof Error ? e.message : e));
    }
  };

  const saveAutoPw = async () => {
    if (autoPw.length < 6) return popup('Too short', 'Use at least 6 characters.');
    await setAutoBackupPassword(autoPw);
    setAutoPw('');
    setAutoPwSet(true);
    popup('Saved', "Weekly backups will be locked with this password. Write it down somewhere safe: without it the backups can't be opened.");
  };

  const backUpNow = async () => {
    setBusy('auto');
    try {
      await afterPaint(() => runAutoBackup());
      repo.deleteKv('last_backup_error');
    } catch (e) {
      popup('Backup failed', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const toggleAuto = async (v: boolean) => {
    saveAuto({ enabled: v });
    if (v && auto.folderUri && autoPwSet) autoBackupIfDue().catch(() => {});
  };

  const lastError = repo.getKv('last_backup_error');

  return (
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={st.hint}>
        Sabr never uploads your data. A backup is a file you keep: save it to Google Drive, your Files app or anywhere else, and restore it on a new phone.
      </Text>

      <SectionTitle>Save a backup</SectionTitle>
      <Card>
        <Field label="Password" hint="Locks the file so only you can open it. There's no way to recover a forgotten password.">
          <Input value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" placeholder="Optional, but recommended" />
        </Field>
        {pw ? (
          <Field label="Password again">
            <Input value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" />
          </Field>
        ) : null}
        <Button
          title={busy === 'export' ? 'Locking...' : 'Save backup'}
          onPress={exportNow}
          disabled={!!busy}
          icon={busy === 'export' ? <ActivityIndicator color={c.onPrimary} /> : null}
        />
        <Text style={[st.hint, { marginTop: 10 }]}>Then pick Drive to keep it in your Google Drive, or Files to keep it on the phone or a card.</Text>
      </Card>

      <SectionTitle>Restore</SectionTitle>
      <Card>
        {pending ? (
          <>
            <Field label="This backup has a password">
              <Input value={restorePw} onChangeText={setRestorePw} secureTextEntry autoCapitalize="none" autoFocus />
            </Field>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Button title="Cancel" kind="secondary" onPress={() => setPending(null)} style={{ flexGrow: 1 }} />
              <Button title={busy === 'restore' ? 'Unlocking...' : 'Unlock'} onPress={() => confirmRestore(pending, restorePw)} disabled={!restorePw || !!busy} style={{ flexGrow: 1 }} />
            </View>
          </>
        ) : (
          <>
            <Text style={st.hint}>Choose a backup file from Google Drive, Files or a download. Everything in the app is replaced by what's in the file.</Text>
            <Button title="Choose a backup file" kind="secondary" onPress={pickRestore} disabled={!!busy} style={{ marginTop: 10 }} />
          </>
        )}
      </Card>

      {Platform.OS === 'android' ? (
        <>
          <SectionTitle>Automatic backup</SectionTitle>
          <Card>
            <ToggleRow
              label="Back up automatically"
              hint="Saves a password-locked backup to a folder you choose, and keeps the last 4."
              value={auto.enabled}
              onChange={toggleAuto}
            />
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Folder</Text>
                <Text style={st.hint}>{auto.folderName ?? 'None chosen yet'}</Text>
              </View>
              <Button title={auto.folderUri ? 'Change' : 'Choose'} small kind="secondary" onPress={chooseFolder} />
            </View>
            <Text style={st.hint}>Pick a folder in your phone's storage, such as Documents. A folder on an SD card survives losing the phone's own storage.</Text>
            <Field label={autoPwSet ? 'Password (set)' : 'Password'} style={{ marginTop: 12 }}>
              <Input value={autoPw} onChangeText={setAutoPw} secureTextEntry autoCapitalize="none" placeholder={autoPwSet ? 'Type a new one to change it' : 'At least 6 characters'} />
            </Field>
            {autoPw ? <Button title="Save password" small kind="secondary" onPress={saveAutoPw} style={{ alignSelf: 'flex-start' }} /> : null}
            <Options value={auto.everyDays} onChange={(everyDays) => saveAuto({ everyDays })} />
            <Text style={[st.hint, { marginTop: 8 }]}>Last backup: {when(lastAutoBackup())}</Text>
            {lastError ? <Text style={[st.hint, { color: c.bad }]}>Last try failed: {lastError}</Text> : null}
            <Button
              title={busy === 'auto' ? 'Backing up...' : 'Back up now'}
              kind="secondary"
              onPress={backUpNow}
              disabled={!!busy || !auto.folderUri || !autoPwSet}
              style={{ marginTop: 10 }}
            />
          </Card>
        </>
      ) : null}
    </PageScroll>
  );
}

function Options({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const st = useRowStyles();
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[st.label, { marginBottom: 6 }]}>How often</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[
          [1, 'Daily'],
          [7, 'Weekly'],
          [14, 'Every 2 weeks'],
        ].map(([d, label]) => (
          <Chip key={d} label={label as string} selected={value === d} onPress={() => onChange(d as number)} />
        ))}
      </View>
    </View>
  );
}

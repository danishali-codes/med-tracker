import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Share, View } from 'react-native';
import { ToggleRow, useRowStyles } from '../components/ToggleRow';
import { Button, Card, Field, Input, SectionTitle, Text } from '../components/ui';
import type { Settings, SyncSettings } from '../domain/types';
import * as repo from '../db/repo';
import { useDbVersion, useSettings } from '../hooks/useData';
import * as sync from '../sync/engine';
import type { Session } from '../sync/pocketbase';
import { useTheme } from '../theme';

const SERVER_GUIDE = 'https://github.com/danishali-codes/med-tracker/blob/main/server/README.md';

/** Optional: a server you run, an encrypted backup, and sharing with a caregiver. */
export default function SyncScreen() {
  const c = useTheme();
  const st = useRowStyles();
  const settings = useSettings();
  useDbVersion();
  const s = settings.sync;
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [server, setServer] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [restoreKey, setRestoreKey] = useState('');

  useEffect(() => {
    sync.getSession().then(setSession);
  }, []);

  const save = (patch: Partial<SyncSettings>) => repo.saveSettings({ ...settings, sync: { ...s, ...patch } } as Settings);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const connect = (create: boolean) =>
    run(create ? 'create' : 'signin', async () => {
      if (!server.trim() || !email.trim() || !password) throw new Error('Fill in the server address, email and password.');
      setSession(await sync.connect(server, email, password, create));
      setPassword('');
    });

  const signOut = () =>
    Alert.alert('Sign out of your server?', 'Sharing and backups stop. Your data on this phone stays.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => run('out', async () => (await sync.disconnect(false), setSession(null), setCode(null))) },
      {
        text: 'Sign out and delete server copies',
        style: 'destructive',
        onPress: () => run('out', async () => (await sync.disconnect(true), setSession(null), setCode(null))),
      },
    ]);

  const lastBackup = repo.getKv('last_backup');
  const lastShare = repo.getKv('last_share');
  const error = repo.getKv('sync_error');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name="lock-closed-outline" size={22} color={c.primary} />
          <Text style={[st.label, { flex: 1 }]}>{s.enabled ? 'Sync is on' : 'Fully private'}</Text>
        </View>
        <Text style={st.hint}>
          {s.enabled
            ? 'Only what you turn on below is sent, and only to your own server. It is locked on this phone before it leaves, so the server stores scrambled data it cannot read.'
            : 'Nothing leaves this phone. Everything below is optional, for people who run their own server and want a backup or to let a family member see their doses.'}
        </Text>
        <ToggleRow
          label="Use my own server"
          hint="A PocketBase server that you or someone you trust runs."
          value={s.enabled}
          onChange={(v) => (v ? save({ enabled: true }) : sync.disconnect(false).then(() => (setSession(null), setCode(null))))}
        />
      </Card>

      {s.enabled ? (
        <>
          <SectionTitle>Server</SectionTitle>
          <Card>
            {session === undefined ? (
              <ActivityIndicator />
            ) : session ? (
              <>
                <Text style={st.label}>{session.email}</Text>
                <Text style={st.hint}>{session.server}</Text>
                <Button title="Sign out" kind="ghost" small onPress={signOut} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
              </>
            ) : (
              <>
                <Field label="Server address">
                  <Input value={server} onChangeText={setServer} placeholder="pb.example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                </Field>
                <Field label="Email">
                  <Input value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
                </Field>
                <Field label="Password">
                  <Input value={password} onChangeText={setPassword} secureTextEntry />
                </Field>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button title={busy === 'signin' ? 'Signing in...' : 'Sign in'} onPress={() => connect(false)} disabled={!!busy} style={{ flex: 1 }} />
                  <Button title="Create account" kind="secondary" onPress={() => connect(true)} disabled={!!busy} style={{ flex: 1 }} />
                </View>
                <Button title="How to set up a server" kind="ghost" small onPress={() => Linking.openURL(SERVER_GUIDE)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
              </>
            )}
            {error ? <Text style={[st.hint, { color: c.bad, marginTop: 8 }]}>{error}</Text> : null}
          </Card>

          {session ? (
            <>
              <SectionTitle>Backup</SectionTitle>
              <Card>
                <ToggleRow
                  label="Keep an encrypted backup"
                  hint={lastBackup ? `Last backed up ${new Date(lastBackup).toLocaleString()}` : 'Your medicines, history and notes. Photos stay on the phone.'}
                  value={s.backup}
                  onChange={(v) => {
                    save({ backup: v });
                    if (v) void sync.pushBackup();
                  }}
                />
                {s.backup ? (
                  <>
                    <Text style={st.hint}>
                      To restore on a new phone you need your recovery key. Keep it somewhere safe, like a password manager. Without it, nobody can open
                      the backup, including you.
                    </Text>
                    {key ? (
                      <Text selectable style={[st.label, { marginTop: 8, fontFamily: undefined, letterSpacing: 0.5 }]}>
                        {key}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                      <Button
                        title={key ? 'Save key' : 'Show recovery key'}
                        kind="secondary"
                        small
                        onPress={async () => (key ? Share.share({ message: key }) : setKey(await sync.backupKey()))}
                      />
                      <Button title={busy === 'backup' ? 'Backing up...' : 'Back up now'} kind="secondary" small onPress={() => run('backup', sync.pushBackup)} />
                    </View>
                  </>
                ) : null}
                <Field label="Restore on this phone" hint="Replaces everything here with the backup on your server." style={{ marginTop: 14 }}>
                  <Input value={restoreKey} onChangeText={setRestoreKey} placeholder="Recovery key" autoCapitalize="none" autoCorrect={false} />
                </Field>
                <Button
                  title={busy === 'restore' ? 'Restoring...' : 'Restore'}
                  kind="secondary"
                  small
                  disabled={!restoreKey.trim() || !!busy}
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() =>
                    Alert.alert('Replace everything on this phone?', 'Your medicines and history here are replaced by the backup.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Restore', style: 'destructive', onPress: () => run('restore', async () => (await sync.restoreBackup(restoreKey), setRestoreKey(''))) },
                    ])
                  }
                />
              </Card>

              <SectionTitle>Share with a caregiver</SectionTitle>
              <Card>
                <ToggleRow
                  label="Let someone see my doses"
                  hint="They see today's and yesterday's doses, whether each was taken, and your week. Only people you give the code to can see it."
                  value={s.share}
                  onChange={(v) => {
                    save({ share: v });
                    if (!v) setCode(null);
                  }}
                />
                {s.share ? (
                  <>
                    <Field label="Name they see">
                      <Input value={s.shareAs} onChangeText={(t) => save({ shareAs: t })} placeholder="e.g. Mum, or your first name" />
                    </Field>
                    <ToggleRow
                      label="Include medicine names"
                      hint={s.shareNames ? 'They see names and doses.' : 'They see "Medicine A", "Medicine B" instead of names.'}
                      value={s.shareNames}
                      onChange={(v) => save({ shareNames: v })}
                    />
                    {lastShare ? <Text style={st.hint}>Last updated {new Date(lastShare).toLocaleTimeString()}</Text> : null}
                    {code ? (
                      <Text selectable style={[st.hint, { marginTop: 10, color: c.text }]}>
                        {code}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                      <Button
                        title={busy === 'code' ? 'Getting code...' : code ? 'Send code' : 'Get share code'}
                        small
                        onPress={() =>
                          run('code', async () => {
                            const c2 = code ?? (await sync.shareCode());
                            if (!c2) throw new Error(repo.getKv('sync_error') ?? 'Could not reach your server.');
                            setCode(c2);
                            if (code) await Share.share({ message: `Follow my medicines in Med Tracker. In the app, go to Settings, then People I look after, and paste this code:\n\n${c2}` });
                          })
                        }
                      />
                      <Button
                        title="Stop old codes working"
                        kind="ghost"
                        small
                        onPress={() =>
                          Alert.alert('Make a new code?', 'Anyone following you with the old code stops seeing your doses.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'New code', style: 'destructive', onPress: () => run('code', async () => (await sync.resetShare(), setCode(await sync.shareCode()))) },
                          ])
                        }
                      />
                    </View>
                  </>
                ) : null}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

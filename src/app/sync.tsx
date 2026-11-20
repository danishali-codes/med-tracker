import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Share, View } from 'react-native';
import { popup } from '../components/Popup';
import { PageScroll } from '../components/Screen';
import { ToggleRow, useRowStyles } from '../components/ToggleRow';
import { Button, Card, Chip, Field, Input, SectionTitle, Text } from '../components/ui';
import type { Settings, SyncSettings } from '../domain/types';
import * as repo from '../db/repo';
import { useDbVersion, useSettings } from '../hooks/useData';
import * as sync from '../sync/engine';
import type { Session } from '../sync/pocketbase';
import { useTheme } from '../theme';

const SERVER_GUIDE = 'https://github.com/danishali-codes/sabr-med-tracker/blob/main/server/README.md';

/** Optional: the Sabr server or one you run, an encrypted backup, and sharing with a caregiver. */
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
  const [where, setWhere] = useState<'sabr' | 'own'>('sabr');
  const [pwUnlock, setPwUnlock] = useState(false);

  useEffect(() => {
    sync.getSession().then(setSession);
    sync.hasPasswordUnlock().then(setPwUnlock);
  }, []);

  const save = (patch: Partial<SyncSettings>) => repo.saveSettings({ ...settings, sync: { ...s, ...patch } } as Settings);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      popup('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const connect = (create: boolean) =>
    run(create ? 'create' : 'signin', async () => {
      const address = where === 'sabr' ? sync.SABR_SERVER : server;
      if (!address.trim() || !email.trim() || !password) throw new Error(where === 'sabr' ? 'Fill in your email and password.' : 'Fill in the server address, email and password.');
      // Stretching the password takes a moment; let the spinner draw first.
      await new Promise((r) => setTimeout(r, 30));
      const s2 = await sync.connect(address, email, password, create);
      setSession(s2);
      setPassword('');
      setPwUnlock(await sync.hasPasswordUnlock());
      if (!create) {
        const found = await sync.backupOnServer().catch(() => null);
        if (found)
          Alert.alert('Restore your backup?', `There's a backup from ${new Date(found).toLocaleString()}. Restoring replaces everything on this phone with it.`, [
            { text: 'Not now', style: 'cancel' },
            { text: 'Restore', style: 'destructive', onPress: () => run('restore', () => sync.restoreBackup(null)) },
          ]);
      }
    });

  const signOut = () =>
    popup('Sign out of your server?', 'Sharing and backups stop. Your data on this phone stays.', [
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
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name="lock-closed-outline" size={22} color={c.primary} />
          <Text style={[st.label, { flex: 1 }]}>{s.enabled ? 'Sync is on' : 'Fully private'}</Text>
        </View>
        <Text style={st.hint}>
          {s.enabled
            ? 'Only what you turn on below is sent. It is locked on this phone before it leaves, so the server stores scrambled data it cannot read, whoever runs it.'
            : 'Nothing leaves this phone. Everything below is optional, for an online backup or to let a family member see their doses.'}
        </Text>
        {settings.fullyLocal ? (
          <Text style={[st.hint, { color: c.warn, marginTop: 6 }]}>Fully local is on, so nothing is sent. Turn it off in Settings, Privacy to use this.</Text>
        ) : (
          <ToggleRow
            label="Back up and share online"
            hint="On the Sabr server, or a PocketBase server you run yourself."
            value={s.enabled}
            onChange={(v) => (v ? save({ enabled: true }) : sync.disconnect(false).then(() => (setSession(null), setCode(null))))}
          />
        )}
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
                <Text style={st.hint}>{sync.isSabrServer(session.server) ? 'Sabr server' : session.server}</Text>
                <Button title="Sign out" kind="ghost" small onPress={signOut} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                  <Chip label="Sabr server" selected={where === 'sabr'} onPress={() => setWhere('sabr')} />
                  <Chip label="My own server" selected={where === 'own'} onPress={() => setWhere('own')} />
                </View>
                {where === 'sabr' ? (
                  <Text style={[st.hint, { marginBottom: 10 }]}>
                    Run by Sabr's developer, free. Your password never leaves this phone: it locks your data here, and the server only gets a code made
                    from it to sign you in. So the server stores your email and scrambled data that nobody there can open. There's no way to reset a
                    forgotten password, so keep it (and your recovery key) somewhere safe.
                  </Text>
                ) : (
                  <Field label="Server address">
                    <Input value={server} onChangeText={setServer} placeholder="pb.example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                  </Field>
                )}
                <Field label="Email">
                  <Input value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
                </Field>
                <Field label="Password" hint={where === 'sabr' ? `At least ${sync.MIN_SABR_PASSWORD} characters. A short sentence is easy to remember and hard to guess.` : undefined}>
                  <Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
                </Field>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Button title={busy === 'signin' ? 'Signing in...' : 'Sign in'} onPress={() => connect(false)} disabled={!!busy} style={{ flexGrow: 1 }} />
                  <Button title="Create account" kind="secondary" onPress={() => connect(true)} disabled={!!busy} style={{ flexGrow: 1 }} />
                </View>
                {where === 'own' ? (
                  <Button title="How to set up a server" kind="ghost" small onPress={() => Linking.openURL(SERVER_GUIDE)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
                ) : null}
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
                      {pwUnlock
                        ? 'To restore on a new phone, sign in with the same email and password. Your recovery key also opens it, if you ever lose the password. Keep both somewhere safe, like a password manager.'
                        : 'To restore on a new phone you need your recovery key. Keep it somewhere safe, like a password manager. Without it, nobody can open the backup, including you.'}
                    </Text>
                    {key ? (
                      <Text selectable style={[st.label, { marginTop: 8, fontFamily: undefined, letterSpacing: 0.5 }]}>
                        {key}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
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
                <Field
                  label="Restore on this phone"
                  hint={
                    pwUnlock
                      ? 'Replaces everything here with your newest backup. Your password opens it; or type your recovery key.'
                      : 'Replaces everything here with the backup on your server.'
                  }
                  style={{ marginTop: 14 }}
                >
                  <Input value={restoreKey} onChangeText={setRestoreKey} placeholder={pwUnlock ? 'Recovery key (optional)' : 'Recovery key'} autoCapitalize="none" autoCorrect={false} />
                </Field>
                <Button
                  title={busy === 'restore' ? 'Restoring...' : 'Restore'}
                  kind="secondary"
                  small
                  disabled={(!pwUnlock && !restoreKey.trim()) || !!busy}
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() =>
                    popup('Replace everything on this phone?', 'Your medicines and history here are replaced by the backup.', [
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
                            if (code) await Share.share({ message: `Follow my medicines in Sabr. In the app, go to Settings, then Backup and sharing, then People I look after, and paste this code:\n\n${c2}` });
                          })
                        }
                      />
                      <Button
                        title="Stop old codes working"
                        kind="ghost"
                        small
                        onPress={() =>
                          popup('Make a new code?', 'Anyone following you with the old code stops seeing your doses.', [
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
    </PageScroll>
  );
}

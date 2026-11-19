import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { CareCard } from '../components/CareCard';
import { ToggleRow, useRowStyles } from '../components/ToggleRow';
import { Button, Card, Chip, Field, Input, SectionTitle, Text } from '../components/ui';
import * as repo from '../db/repo';
import { useSettings } from '../hooks/useData';
import { useFollowing } from '../hooks/useFollowing';
import * as sync from '../sync/engine';

/** Following a family member's doses with the code they sent you. */
export default function CareScreen() {
  const st = useRowStyles();
  const settings = useSettings();
  const people = useFollowing();
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void sync
      .getFollowing()
      .then(() => setLoaded(true))
      .then(() => sync.refreshFollowing());
  }, []);

  const add = async () => {
    setBusy(true);
    try {
      const p = await sync.follow(text);
      setText('');
      Alert.alert('Added', `You can now see ${p.status?.name ?? 'their'} doses.`);
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const care = settings.care;
  const setCare = (patch: Partial<typeof care>) => {
    repo.saveSettings({ ...settings, care: { ...care, ...patch } });
    void sync.scheduleCareAlerts();
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), sync.refreshFollowing().finally(() => setRefreshing(false)))} />}
    >
      {loaded && people.length === 0 ? (
        <Card>
          <Text style={st.label}>Look after someone's medicines</Text>
          <Text style={st.hint}>
            If a family member uses Sabr with their own server, they can send you a share code from Settings, Sync and sharing. Paste it below to see
            whether they've taken today's doses. You don't need an account.
          </Text>
        </Card>
      ) : null}

      {people.map((p) => (
        <View key={p.code.id}>
          <CareCard person={p} graceMinutes={care.graceMinutes} />
          <Button
            title="Stop following"
            kind="ghost"
            small
            style={{ alignSelf: 'flex-end' }}
            onPress={() =>
              Alert.alert('Stop following?', 'You can add them again with their code.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Stop', style: 'destructive', onPress: () => void sync.unfollow(p.code.id) },
              ])
            }
          />
        </View>
      ))}

      <SectionTitle>Add someone</SectionTitle>
      <Card>
        <Field label="Share code" hint="Starts with MT1:">
          <Input value={text} onChangeText={setText} placeholder="MT1:..." autoCapitalize="none" autoCorrect={false} multiline />
        </Field>
        <Button title={busy ? 'Checking...' : 'Add'} onPress={add} disabled={busy || !text.trim()} style={{ alignSelf: 'flex-start' }} />
      </Card>

      {people.length > 0 ? (
        <>
          <SectionTitle>Alerts</SectionTitle>
          <Card>
            <ToggleRow
              label="Tell me about missed doses"
              hint="Based on their last update. The app checks again when you open it and a few times a day."
              value={care.alerts}
              onChange={(v) => setCare({ alerts: v })}
            />
            {care.alerts ? (
              <>
                <Text style={[st.label, { marginTop: 6, marginBottom: 6 }]}>After</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {[30, 60, 120].map((m) => (
                    <Chip key={m} label={`${m} min`} selected={care.graceMinutes === m} onPress={() => setCare({ graceMinutes: m })} />
                  ))}
                </View>
              </>
            ) : null}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

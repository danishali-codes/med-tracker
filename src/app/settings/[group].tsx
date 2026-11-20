import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { PageScroll } from '../../components/Screen';
import { useSettings } from '../../hooks/useData';
import { SETTINGS_GROUPS } from '../../settings/groups';
import { GroupBody } from '../../settings/render';

export default function SettingsGroupScreen() {
  const { group: id } = useLocalSearchParams<{ group: string }>();
  const settings = useSettings();
  const group = SETTINGS_GROUPS.find((g) => g.id === id);
  if (!group) return <Redirect href="/settings" />;
  return (
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: group.title }} />
      <GroupBody group={group} settings={settings} />
    </PageScroll>
  );
}

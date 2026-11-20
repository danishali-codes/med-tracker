import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { PageScroll } from '../../components/Screen';
import { Card, Text } from '../../components/ui';
import { useSettings } from '../../hooks/useData';
import { SETTINGS_GROUPS } from '../../settings/groups';
import { GroupRow, ItemList, ModeSwitch, platform } from '../../settings/render';
import { updateSettings, useSettingStyles } from '../../settings/rows';
import { groupShown, searchSettings } from '../../settings/search';
import { FONT, makeStyles, radius, useTheme } from '../../theme';

export default function SettingsScreen() {
  const c = useTheme();
  const s = useStyles();
  const st = useSettingStyles();
  const settings = useSettings();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const hits = useMemo(() => (searching ? searchSettings(SETTINGS_GROUPS, query, settings, platform) : []), [searching, query, settings]);
  const groups = SETTINGS_GROUPS.filter((g) => groupShown(g, platform));

  return (
    <PageScroll contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={s.search}>
        <Ionicons name="search" size={20} color={c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search settings"
          placeholderTextColor={c.faint}
          style={s.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search settings"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={c.faint} />
          </Pressable>
        ) : null}
      </View>

      {searching ? (
        hits.length ? (
          hits.map(({ group, items }) => (
            <View key={group.id}>
              <Pressable onPress={() => router.push(`/settings/${group.id}`)} style={s.hitHeader} accessibilityRole="button" accessibilityHint="Opens this settings page">
                <Ionicons name={group.icon} size={16} color={c.muted} />
                <Text style={s.hitGroup}>{group.title}</Text>
                <Ionicons name="chevron-forward" size={14} color={c.faint} />
              </Pressable>
              <Card>
                <ItemList items={items} settings={settings} />
              </Card>
            </View>
          ))
        ) : (
          <View style={s.empty}>
            <Text style={st.label}>Nothing matches "{query.trim()}"</Text>
            <Text style={[st.hint, { textAlign: 'center' }]}>Try another word, like reminders, dark, backup or lock.</Text>
          </View>
        )
      ) : (
        <>
          <ModeSwitch advanced={settings.showAdvanced} onChange={(showAdvanced) => updateSettings({ showAdvanced })} />
          <Text style={[st.hint, { marginHorizontal: 8, marginTop: 8, marginBottom: 14 }]}>
            {settings.showAdvanced ? 'Showing every setting.' : 'Showing the everyday settings. Advanced adds fine-tuning, like snooze length and repeat timing.'}
          </Text>
          <Card>
            {groups.map((g, i) => (
              <View key={g.id}>
                {i > 0 ? <View style={s.divider} /> : null}
                <GroupRow group={g} settings={settings} />
              </View>
            ))}
          </Card>
          <Text style={[st.hint, { textAlign: 'center', marginTop: 8 }]}>
            Sabr {Application.nativeApplicationVersion ?? ''} ({Application.nativeBuildVersion ?? ''})
          </Text>
        </>
      )}
    </PageScroll>
  );
}

const useStyles = makeStyles((c) => ({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.card,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text, fontFamily: FONT.semibold },
  hitHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 8, paddingHorizontal: 6 },
  hitGroup: { fontSize: 13, fontWeight: '800', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
}));

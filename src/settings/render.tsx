import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Card, PressableScale, SectionTitle, Text } from '../components/ui';
import { featureInfo, type FeatureId } from '../domain/features';
import type { Settings } from '../domain/types';
import { setFeature } from './features';
import { makeStyles, useTheme } from '../theme';
import { updateSettings, useSettingStyles } from './rows';
import { hiddenAdvancedCount, itemShown } from './search';
import type { SettingItem, SettingsGroup } from './types';

export const platform = { android: Platform.OS === 'android' };

/** The items of one card, with a thin line between them. */
export function ItemList({ items, settings }: { items: SettingItem[]; settings: Settings }) {
  const s = useStyles();
  return (
    <>
      {items.map((item, i) => (
        <Fragment key={item.id}>
          {i > 0 ? <View style={s.divider} /> : null}
          {item.feature && !settings.features[item.feature] ? (
            <FeatureOffRow item={item} feature={item.feature} />
          ) : (
            <item.Component settings={settings} update={updateSettings} />
          )}
        </Fragment>
      ))}
    </>
  );
}

/** Search found a setting whose feature is off: say so, and offer to turn the feature on. */
function FeatureOffRow({ item, feature }: { item: SettingItem; feature: FeatureId }) {
  const c = useTheme();
  const st = useSettingStyles();
  const info = featureInfo(feature);
  return (
    <PressableScale onPress={() => setFeature(feature, true)} style={st.linkRow} scaleTo={0.98} accessibilityRole="button" accessibilityHint={`Turns on ${info.title}`}>
      <View style={st.iconBubble}>
        <Ionicons name={info.icon} size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{item.title}</Text>
        <Text style={st.hint}>
          Part of {info.title}, which is off. <Text style={{ color: c.primary, fontWeight: '800' }}>Turn it on</Text>
        </Text>
      </View>
    </PressableScale>
  );
}

/** A whole group page: each section as a titled card, with a note when Simple mode hides some. */
export function GroupBody({ group, settings }: { group: SettingsGroup; settings: Settings }) {
  const c = useTheme();
  const st = useSettingStyles();
  const s = useStyles();
  const advanced = settings.showAdvanced;
  const hidden = advanced ? 0 : hiddenAdvancedCount(group, settings, platform);
  return (
    <>
      {group.sections.map((section, i) => {
        const items = section.items.filter((it) => itemShown(it, settings, { ...platform, advanced }));
        if (!items.length) return null;
        return (
          <View key={section.title ?? i}>
            {section.title ? <SectionTitle>{section.title}</SectionTitle> : null}
            <Card>
              <ItemList items={items} settings={settings} />
            </Card>
          </View>
        );
      })}
      {hidden ? (
        <Pressable onPress={() => updateSettings({ showAdvanced: true })} style={s.moreRow} accessibilityRole="button">
          <Ionicons name="options-outline" size={18} color={c.primary} />
          <Text style={[st.hint, { flex: 1, marginTop: 0 }]}>
            {hidden} more {hidden === 1 ? 'setting' : 'settings'} in Advanced.{' '}
            <Text style={{ color: c.primary, fontWeight: '800' }}>Show them</Text>
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

/** A row in the Settings list that opens a group. */
export function GroupRow({ group, settings }: { group: SettingsGroup; settings: Settings }) {
  const c = useTheme();
  const st = useSettingStyles();
  return (
    <PressableScale onPress={() => router.push(`/settings/${group.id}`)} style={st.linkRow} scaleTo={0.98} accessibilityRole="button">
      <View style={st.iconBubble}>
        <Ionicons name={group.icon} size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{group.title}</Text>
        <Text style={st.hint} numberOfLines={2}>
          {group.summary?.(settings) || group.blurb}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.faint} />
    </PressableScale>
  );
}

/** Simple or Advanced, side by side. */
export function ModeSwitch({ advanced, onChange }: { advanced: boolean; onChange: (advanced: boolean) => void }) {
  const s = useStyles();
  return (
    <View style={s.segment} accessibilityRole="radiogroup">
      {(
        [
          [false, 'Simple'],
          [true, 'Advanced'],
        ] as const
      ).map(([v, label]) => {
        const on = advanced === v;
        return (
          <Pressable key={label} onPress={() => onChange(v)} style={[s.segmentItem, on && s.segmentOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
            <Text style={[s.segmentText, on && s.segmentTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  divider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 999, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segmentOn: { backgroundColor: c.card, shadowColor: c.shadow, shadowOpacity: c.dark ? 0 : 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: c.dark ? 0 : 1 },
  segmentText: { fontSize: 15, fontWeight: '700', color: c.muted },
  segmentTextOn: { color: c.text, fontWeight: '800' },
}));

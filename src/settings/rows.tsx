import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ToggleRow } from '../components/ToggleRow';
import { Chip, PressableScale, Text } from '../components/ui';
import * as repo from '../db/repo';
import type { Settings } from '../domain/types';
import { rescheduleAll, resetNotificationSetup } from '../notifications/reminders';
import { makeStyles, useTheme } from '../theme';
import type { SettingCtx, SettingItem } from './types';

/** Saves a settings change on top of what's stored now, then reschedules reminders. */
export function updateSettings(patch: Partial<Settings>) {
  repo.saveSettings({ ...repo.getSettings(), ...patch });
  if (patch.snoozeMinutes) resetNotificationSetup();
  rescheduleAll().catch(() => {});
}

type Base = Omit<SettingItem, 'Component'>;

/** An on/off setting. liveHint replaces the hint on screen, e.g. to say what "on" means right now. */
export function toggle(
  o: Base & {
    get: (s: Settings) => boolean;
    set: (v: boolean, s: Settings) => Partial<Settings>;
    liveHint?: (s: Settings) => string;
    /** Saves the change itself instead, e.g. after asking for a fingerprint. */
    handle?: (v: boolean, ctx: SettingCtx) => Promise<void>;
    /** Runs after the change is saved. */
    afterChange?: (v: boolean) => void;
    /** Extra content under the switch, such as a status line. */
    after?: (ctx: SettingCtx) => ReactNode;
  },
): SettingItem {
  const { get, set, liveHint, handle, afterChange, after, ...item } = o;
  return {
    ...item,
    Component: (ctx) => (
      <>
        <ToggleRow
          label={o.title}
          hint={liveHint ? liveHint(ctx.settings) : o.hint}
          value={get(ctx.settings)}
          onChange={(v) => {
            if (handle) return void handle(v, ctx).catch(() => {});
            ctx.update(set(v, ctx.settings));
            afterChange?.(v);
          }}
        />
        {after ? after(ctx) : null}
      </>
    ),
  };
}

/** Pick one number from a few, shown as chips. */
export function choice(
  o: Base & { get: (s: Settings) => number; set: (v: number, s: Settings) => Partial<Settings>; options: number[]; suffix: string; note?: string },
): SettingItem {
  const { get, set, options, suffix, note, ...item } = o;
  return {
    ...item,
    Component: ({ settings, update }) => (
      <Options label={o.title} value={get(settings)} options={options} suffix={suffix} onChange={(v) => update(set(v, settings))} note={note} />
    ),
  };
}

/** Opens another page. summary shows live status under the title. */
export function link(o: Base & { icon: keyof typeof Ionicons.glyphMap; href: Href; summary?: (s: Settings) => string | null }): SettingItem {
  const { icon, href, summary, ...item } = o;
  return {
    ...item,
    Component: ({ settings }) => <LinkRow icon={icon} title={o.title} hint={summary?.(settings) || o.hint} onPress={() => router.push(href)} />,
  };
}

export function LinkRow({ icon, title, hint, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint?: string; onPress: () => void }) {
  const c = useTheme();
  const st = useSettingStyles();
  return (
    <PressableScale onPress={onPress} style={st.linkRow} scaleTo={0.98} accessibilityRole="button">
      <View style={st.iconBubble}>
        <Ionicons name={icon} size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{title}</Text>
        {hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.faint} />
    </PressableScale>
  );
}

export function Options({
  label,
  value,
  options,
  suffix,
  onChange,
  note,
}: {
  label: string;
  value: number;
  options: number[];
  suffix: string;
  onChange: (v: number) => void;
  note?: string;
}) {
  const st = useSettingStyles();
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={[st.label, { marginBottom: 6 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {options.map((o) => (
          <Chip key={o} label={o === 0 ? 'Straight away' : `${o} ${o === 1 && suffix === 'times' ? 'time' : suffix}`} selected={value === o} onPress={() => onChange(o)} />
        ))}
      </View>
      {note ? <Text style={st.hint}>{note}</Text> : null}
    </View>
  );
}

export const useSettingStyles = makeStyles((c) => ({
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  iconBubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  label: { fontSize: 15, color: c.text, fontWeight: '800' },
  hint: { fontSize: 13, color: c.muted, marginTop: 2, fontWeight: '600', lineHeight: 18 },
}));

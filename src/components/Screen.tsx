import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { makeStyles, useTheme } from '../theme';
import { PressableScale, Text } from './ui';

/** Height of the floating tab bar, and its gap above the bottom edge. */
export const TAB_BAR_HEIGHT = 68;
export const tabBarBottom = (insetBottom: number) => Math.max(insetBottom, 12);

/**
 * Scrollable tab screen with a large title, leaving room for the floating tab bar.
 * The status bar gets a solid strip so scrolled content never runs into the clock and icons,
 * and content fades out above the tab bar instead of being sliced by it.
 */
export function Screen({
  title,
  subtitle,
  right,
  children,
  ...props
}: ScrollViewProps & { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const s = useStyles();
  const barTop = tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT;
  const fade = 28;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        {...props}
        contentContainerStyle={[{ paddingTop: insets.top + 12, paddingBottom: barTop + 32, paddingHorizontal: 18 }, props.contentContainerStyle]}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            <Text style={s.title}>{title}</Text>
          </View>
          {right ?? <SettingsButton />}
        </View>
        {children}
      </ScrollView>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: undefined, height: insets.top, backgroundColor: c.bg }]} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: barTop + fade }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="tabFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.bg} stopOpacity={0} />
              <Stop offset={String(fade / (barTop + fade))} stopColor={c.bg} stopOpacity={1} />
              <Stop offset="1" stopColor={c.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#tabFade)" />
        </Svg>
      </View>
    </View>
  );
}

/**
 * Scrollable page under a header (Settings, the medication editor and so on). Android draws
 * the app under the navigation bar, so the last item gets the bar's height on top of the usual gap.
 */
export function PageScroll({ contentContainerStyle, ...props }: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  const own = StyleSheet.flatten(contentContainerStyle) ?? {};
  const bottom = typeof own.paddingBottom === 'number' ? own.paddingBottom : 40;
  return <ScrollView {...props} contentContainerStyle={[{ padding: 16 }, own, { paddingBottom: bottom + insets.bottom }]} />;
}

export function RoundButton({ icon, onPress, label }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  const c = useTheme();
  const s = useStyles();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} haptic style={s.round}>
      <Ionicons name={icon} size={22} color={c.text} />
    </PressableScale>
  );
}

function SettingsButton() {
  return <RoundButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />;
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 10 },
  subtitle: { fontSize: 14, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 32, fontWeight: '900', color: c.text, letterSpacing: -0.5 },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: c.dark ? 1 : 0,
    borderColor: c.border,
    shadowColor: c.shadow,
    shadowOpacity: c.dark ? 0 : 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: c.dark ? 0 : 2,
  },
}));

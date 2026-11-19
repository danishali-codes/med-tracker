import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../theme';
import { PressableScale, Text } from './ui';

/** Scrollable tab screen with a large title, leaving room for the floating tab bar. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  ...props
}: ScrollViewProps & { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return (
    <ScrollView {...props} contentContainerStyle={[{ paddingTop: insets.top + 12, paddingBottom: 130 + insets.bottom, paddingHorizontal: 18 }, props.contentContainerStyle]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          <Text style={s.title}>{title}</Text>
        </View>
        {right ?? <SettingsButton />}
      </View>
      {children}
    </ScrollView>
  );
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

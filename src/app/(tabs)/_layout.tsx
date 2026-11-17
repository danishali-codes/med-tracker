import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs } from 'expo-router';
import { Pressable, type ColorValue } from 'react-native';
import { colors } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
        headerRight: () => (
          <Link href="/settings" asChild>
            <Pressable hitSlop={12} style={{ marginRight: 16 }} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          </Link>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('today-outline') }} />
      <Tabs.Screen name="calendar" options={{ title: 'History', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="meds" options={{ title: 'Meds', tabBarIcon: icon('medkit-outline') }} />
      <Tabs.Screen name="room" options={{ title: 'My room', tabBarIcon: icon('home-outline') }} />
    </Tabs>
  );
}

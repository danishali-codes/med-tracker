import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Appearance, AppState, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSettings } from '../hooks/useData';
import { registerBackgroundTasks } from '../notifications/background';
import { handleReminderAction, rescheduleAll, setupNotifications } from '../notifications/reminders';
import { dark, FONT, light, ThemeContext } from '../theme';
import { refreshWidget } from '../widget/update';

// Show reminders even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const settings = useSettings();
  const system = useColorScheme();

  // Native pieces (date pickers, alerts) follow the chosen appearance too.
  useEffect(() => {
    Appearance.setColorScheme(settings.appearance === 'system' ? 'unspecified' : settings.appearance);
  }, [settings.appearance]);

  const isDark = settings.appearance === 'system' ? system === 'dark' : settings.appearance === 'dark';
  const c = isDark ? dark : light;
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, primary: c.primary, border: c.border } };
  }, [isDark, c]);

  useEffect(() => {
    setupNotifications()
      .then(() => rescheduleAll())
      .catch((e) => console.warn('notification setup failed', e));
    registerBackgroundTasks();
    refreshWidget();

    // Buttons pressed while the app is open (Android also runs the background task; handling is idempotent).
    const responses = Notifications.addNotificationResponseReceivedListener((r) => {
      handleReminderAction(r.actionIdentifier, r.notification.request.content.data).catch((e) => console.warn(e));
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') rescheduleAll().catch(() => {});
    });
    return () => {
      responses.remove();
      appState.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={c}>
        <ThemeProvider value={navTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: c.bg },
              headerShadowVisible: false,
              headerTintColor: c.text,
              headerTitleStyle: { fontFamily: FONT.extrabold },
              contentStyle: { backgroundColor: c.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="med/[id]" options={{ title: 'Medication', presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="interactions" options={{ title: 'Interactions' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack>
        </ThemeProvider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

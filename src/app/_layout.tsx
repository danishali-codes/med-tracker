import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerBackgroundTasks } from '../notifications/background';
import { handleReminderAction, rescheduleAll, setupNotifications } from '../notifications/reminders';
import { colors } from '../theme';

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
  useEffect(() => {
    setupNotifications()
      .then(() => rescheduleAll())
      .catch((e) => console.warn('notification setup failed', e));
    registerBackgroundTasks();

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

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="med/[id]" options={{ title: 'Medication', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

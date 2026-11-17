import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

export interface PermissionState {
  notifications: boolean;
  exactAlarms: boolean;
}

export async function getPermissionState(): Promise<PermissionState> {
  const n = await Notifications.getPermissionsAsync();
  let exact = true;
  if (Platform.OS === 'android') {
    try {
      exact = (await Notifications.getExactAlarmPermissionsAsync()).granted;
    } catch {
      exact = false;
    }
  }
  return { notifications: n.granted, exactAlarms: exact };
}

export async function requestNotificationPermission(): Promise<boolean> {
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return res.granted;
}

/** Opens Android's "Alarms & reminders" screen for this app. */
export async function requestExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Samsung and others put apps to sleep to save battery, which can delay reminders.
 * This opens the system screen where the user can let the app run unrestricted.
 */
export async function openBatterySettings() {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', {
      data: `package:${Application.applicationId}`,
    });
  } catch {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    } catch {
      await Linking.openSettings();
    }
  }
}

export function openAppSettings() {
  return Linking.openSettings();
}

import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import * as repo from '../db/repo';
import { useSettings } from '../hooks/useData';
import { useTheme } from '../theme';
import { Button, Text } from './ui';

/** Whether the phone has a fingerprint, face or screen lock that can unlock the app. */
export async function canUseAppLock(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

let authenticating = false;

/** Asks for fingerprint, face or the phone's PIN, pattern or password. */
export async function unlockWithDevice(prompt = 'Unlock Sabr'): Promise<boolean> {
  authenticating = true;
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: false, cancelLabel: 'Cancel' });
    return r.success;
  } catch {
    return false;
  } finally {
    // The PIN screen briefly sends the app to the background; don't count that as leaving.
    setTimeout(() => {
      authenticating = false;
    }, 800);
  }
}

/**
 * Covers the app until it's unlocked, when the app lock is on. Locks again when the app
 * comes back after being away longer than the chosen time. Reminders and their buttons keep
 * working while locked, because they don't open the app.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const c = useTheme();
  const [locked, setLocked] = useState(() => repo.getSettings().appLock);
  const leftAt = useRef<number | null>(null);
  const asking = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const ok = await unlockWithDevice();
    asking.current = false;
    if (ok) setLocked(false);
  }, []);

  useEffect(() => {
    if (!settings.appLock) setLocked(false);
  }, [settings.appLock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const lock = repo.getSettings();
      if (s === 'background') {
        if (!authenticating) leftAt.current = Date.now();
      } else if (s === 'active') {
        if (leftAt.current == null) return;
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (lock.appLock && !authenticating && away >= lock.lockAfterMinutes * 60_000) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (locked) tryUnlock();
  }, [locked, tryUnlock]);

  // Blank the app in the recent apps screen. On Android this also blocks screenshots.
  useEffect(() => {
    const on = settings.hideInRecents;
    (async () => {
      try {
        if (on) {
          await ScreenCapture.preventScreenCaptureAsync('recents');
          if (Platform.OS === 'ios') await ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
        } else {
          await ScreenCapture.allowScreenCaptureAsync('recents');
          if (Platform.OS === 'ios') await ScreenCapture.disableAppSwitcherProtectionAsync();
        }
      } catch {
        // Not available on this phone; nothing to do.
      }
    })();
  }, [settings.hideInRecents]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="lock-closed" size={38} color={c.primary} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: c.text, marginTop: 18 }}>Sabr is locked</Text>
          <Text style={{ fontSize: 15, color: c.muted, marginTop: 6, textAlign: 'center' }}>Use your fingerprint, face or phone PIN to open it.</Text>
          <Button title="Unlock" onPress={tryUnlock} style={{ marginTop: 24, alignSelf: 'stretch' }} />
        </View>
      ) : null}
    </View>
  );
}

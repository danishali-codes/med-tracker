import { Linking, Platform } from 'react-native';
import { SabrHealth } from '../../modules/sabr-health';
import type { DateKey } from '../domain/dates';
import type { HealthDay, HealthKind } from '../domain/health';
import * as repo from '../db/repo';

// Health data comes from Health Connect on the phone: Samsung Health (and a Galaxy Watch
// through it), Google Fit and most watch apps share steps, sleep and heart rate there.
// Read-only, off by default, kept in memory only. Nothing here goes online.

export type HealthStatus = 'ready' | 'needsInstall' | 'unavailable';

/** Health Connect is there and the setting is on. Counts as off if settings can't be read. */
export function healthEnabled(): boolean {
  try {
    return Platform.OS === 'android' && SabrHealth != null && repo.getSettings().healthConnect === true;
  } catch {
    return false;
  }
}

export function healthStatus(): HealthStatus {
  if (Platform.OS !== 'android' || SabrHealth == null) return 'unavailable';
  try {
    return SabrHealth.status();
  } catch {
    return 'unavailable';
  }
}

export async function grantedKinds(): Promise<HealthKind[]> {
  if (healthStatus() !== 'ready') return [];
  try {
    return await SabrHealth!.granted();
  } catch {
    return [];
  }
}

/** Shows Health Connect's own screen to pick what Sabr may read. */
export async function requestHealthAccess(): Promise<HealthKind[]> {
  if (healthStatus() !== 'ready') return [];
  const kinds = await SabrHealth!.request();
  cache.clear();
  return kinds;
}

export function openHealthConnect() {
  if (healthStatus() === 'ready') {
    try {
      SabrHealth!.openSettings();
      return;
    } catch {
      // fall through to the store page
    }
  }
  installHealthConnect();
}

export function installHealthConnect() {
  Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() =>
    Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata').catch(() => {}),
  );
}

const cache = new Map<string, { at: number; days: HealthDay[] }>();
const FRESH_MS = 5 * 60 * 1000;

/**
 * Daily health data for a range of days, or [] while the setting is off or nothing is allowed.
 * Held in memory for a few minutes so moving between screens doesn't read it again.
 */
export async function readHealth(from: DateKey, to: DateKey): Promise<HealthDay[]> {
  if (!healthEnabled() || healthStatus() !== 'ready') return [];
  const key = `${from}~${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.days;
  try {
    const days = await SabrHealth!.daily(from, to);
    cache.set(key, { at: Date.now(), days });
    return days;
  } catch (e) {
    console.warn('health read failed', e);
    return [];
  }
}

/** Forget what was read, e.g. when the setting is turned off. */
export function clearHealthCache() {
  cache.clear();
}

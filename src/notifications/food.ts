import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatTime, timeFromDate } from '../domain/dates';
import { eatAfter } from '../domain/routines';
import * as repo from '../db/repo';

export const TIMER_CHANNEL_ID = 'timers';
const FOOD_ID = 'food-timer';
const KEY = 'food_timer';

export async function setupTimerChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
    name: 'Food timers',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    sound: 'default',
  });
}

/** The running food timer, if one hasn't finished yet. */
export function foodTimer(now = new Date()): Date | null {
  const raw = repo.getKv(KEY);
  if (!raw) return null;
  const until = new Date(raw);
  return until.getTime() > now.getTime() ? until : null;
}

/**
 * After doses are taken: if any is an empty-stomach medicine with a wait, start (or extend)
 * the timer and schedule a notice for when it's fine to eat. The notice never names the medicine.
 */
export async function startFoodTimer(medIds: string[], at = new Date()) {
  const s = repo.getSettings();
  if (!s.foodTimers) return;
  const meds = medIds.map((id) => repo.getMed(id)).filter((m) => m != null);
  const until = eatAfter(meds, at);
  if (!until || until.getTime() <= Date.now()) return;
  const current = foodTimer();
  if (current && current.getTime() >= until.getTime()) return;
  repo.setKv(KEY, until.toISOString());
  await Notifications.cancelScheduledNotificationAsync(FOOD_ID).catch(() => {});
  await setupTimerChannel().catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: FOOD_ID,
    content: { title: 'You can eat now', body: `The wait after your medicine ended at ${formatTime(timeFromDate(until))}.`, data: {} },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: until,
      ...(Platform.OS === 'android' ? { channelId: TIMER_CHANNEL_ID } : {}),
    },
  });
}

export async function stopFoodTimer() {
  repo.deleteKv(KEY);
  await Notifications.cancelScheduledNotificationAsync(FOOD_ID).catch(() => {});
}

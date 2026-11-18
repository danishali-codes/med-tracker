import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatTime, toDateKey } from '../domain/dates';
import { daysOfSupply, describeDose, units } from '../domain/dose';
import { groupFromReminderId, groupKey, planReminders, REMINDER_PREFIX, type PlannedReminder } from '../domain/reminders';
import { slotKey } from '../domain/schedule';
import type { Medication } from '../domain/types';
import * as repo from '../db/repo';

export const CHANNEL_ID = 'dose-reminders';
export const REFILL_CHANNEL_ID = 'refills';
export const CATEGORY_ID = 'dose';
export const ACTION_TAKEN = 'taken';
export const ACTION_SNOOZE = 'snooze';
export const ACTION_SKIP = 'skip';

// Android allows ~500 alarms per app; iOS keeps only 64 pending notifications.
const MAX_SCHEDULED = Platform.OS === 'ios' ? 60 : 300;
const HORIZON_DAYS = Platform.OS === 'ios' ? 3 : 10;

let setupDone = false;

/** Channels and the Taken / Snooze / Skip buttons. Safe to call repeatedly. */
export async function setupNotifications() {
  if (setupDone) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Dose reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 250, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      bypassDnd: false,
    });
    await Notifications.setNotificationChannelAsync(REFILL_CHANNEL_ID, {
      name: 'Refill alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const snooze = repo.getSettings().snoozeMinutes;
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_TAKEN, buttonTitle: '✓ Taken', options: { opensAppToForeground: false } },
    { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${snooze} min`, options: { opensAppToForeground: false } },
    { identifier: ACTION_SKIP, buttonTitle: 'Skip', options: { opensAppToForeground: false, isDestructive: true } },
  ]);
  setupDone = true;
}

/** Call after the snooze length changes so the button label updates. */
export function resetNotificationSetup() {
  setupDone = false;
}

function contentFor(r: PlannedReminder, meds: Map<string, Medication>): Notifications.NotificationContentInput {
  const names = r.medIds.map((id) => meds.get(id)).filter((m): m is Medication => !!m);
  const list = names.map((m) => `${m.name} (${describeDose(m)})`).join(', ');
  const when = formatTime(r.time);
  const title =
    r.kind === 'nag'
      ? `Still waiting: ${when} meds`
      : r.kind === 'snoozed'
        ? `Snoozed reminder: ${when} meds`
        : names.length === 1
          ? `Time for ${names[0].name}`
          : `Time for your ${when} meds`;
  return {
    title,
    body: list,
    data: { date: r.date, time: r.time, medIds: r.medIds },
    categoryIdentifier: CATEGORY_ID,
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.MAX,
    autoDismiss: true,
    threadIdentifier: groupKey(r.date, r.time),
  };
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Cancels our pending reminders and schedules them again from the current data.
 * Runs after every change. Calls that overlap are merged into one extra pass.
 */
export function rescheduleAll(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await rescheduleOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function rescheduleOnce() {
  await setupNotifications();
  const now = new Date();
  repo.pruneSnoozes(toDateKey(now));
  const meds = repo.getMeds();
  const settings = repo.getSettings();
  const plan = planReminders({
    meds,
    logs: new Map(repo.getLogs(toDateKey(new Date(now.getTime() - 2 * 86_400_000)), '9999-12-31').map((l) => [l.slot, l])),
    snoozes: repo.getSnoozes(),
    now,
    settings,
    horizonDays: HORIZON_DAYS,
    maxCount: MAX_SCHEDULED,
  });

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const byId = new Map(meds.map((m) => [m.id, m]));
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: contentFor(r, byId),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        channelId: CHANNEL_ID,
        delivery: settings.alarmStyle ? 'alarmClock' : 'bestEffort',
      },
    });
  }
}

/** Removes any reminder for this time slot that's showing in the notification shade. */
export async function dismissGroup(group: string) {
  const shown = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    shown
      .filter((n) => groupFromReminderId(n.request.identifier) === group)
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  );
}

interface ReminderData {
  date: string;
  time: string;
  medIds: string[];
}

function readData(data: unknown): ReminderData | null {
  const d = data as Partial<ReminderData> | null;
  if (!d || typeof d.date !== 'string' || typeof d.time !== 'string' || !Array.isArray(d.medIds)) return null;
  return { date: d.date, time: d.time, medIds: d.medIds as string[] };
}

/**
 * Handles a tap on Taken / Snooze / Skip. Runs both from the app and from the
 * background task (Android runs it even when the app is closed). Repeating it is harmless.
 */
export async function handleReminderAction(actionId: string, rawData: unknown) {
  const data = readData(rawData);
  if (!data) return;
  const group = groupKey(data.date, data.time);
  const now = new Date();

  if (actionId === ACTION_TAKEN || actionId === ACTION_SKIP) {
    const status = actionId === ACTION_TAKEN ? 'taken' : 'skipped';
    const low: Medication[] = [];
    for (const medId of data.medIds) {
      const slot = slotKey(medId, data.date, data.time);
      if (repo.getLog(slot)) continue; // already answered in the app
      low.push(...repo.setDose({ slot, medId, date: data.date, time: data.time }, status, now));
    }
    repo.clearSnooze(group);
    await notifyLowStock(low);
  } else if (actionId === ACTION_SNOOZE) {
    const minutes = repo.getSettings().snoozeMinutes;
    repo.setSnooze(group, new Date(now.getTime() + minutes * 60_000));
  } else {
    return; // plain tap opens the app; nothing to record
  }
  await dismissGroup(group);
  await rescheduleAll();
}

export async function notifyLowStock(meds: Medication[]) {
  for (const m of meds) {
    const days = daysOfSupply(m);
    const left = `${units(m.form, m.stock ?? 0)} left${days != null ? `, about ${days === 1 ? '1 day' : `${days} days`}` : ''}`;
    await Notifications.scheduleNotificationAsync({
      identifier: `refill:${m.id}`,
      content: {
        title: `Running low on ${m.name}`,
        body: `${left}. Time to order a refill.`,
        data: { medId: m.id },
      },
      trigger: Platform.OS === 'android' ? { channelId: REFILL_CHANNEL_ID } : null,
    });
  }
}

export async function sendTestReminder() {
  await setupNotifications();
  const at = new Date(Date.now() + 10_000);
  await Notifications.scheduleNotificationAsync({
    identifier: 'test-reminder',
    content: {
      title: 'Test reminder',
      body: 'If you can see this with buttons, reminders are working.',
      categoryIdentifier: CATEGORY_ID,
      sound: 'default',
      data: {},
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: CHANNEL_ID,
      delivery: repo.getSettings().alarmStyle ? 'alarmClock' : 'bestEffort',
    },
  });
}

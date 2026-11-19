import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatTime, toDateKey } from '../domain/dates';
import { daysOfSupply, units } from '../domain/dose';
import { groupFromReminderId, groupKey, planReminders, refillText, REMINDER_PREFIX, reminderText, type PlannedReminder } from '../domain/reminders';
import { dosesOn, slotKey } from '../domain/schedule';
import type { Medication } from '../domain/types';
import * as repo from '../db/repo';

// Android doesn't let an app change a channel's lock screen setting once it exists, so the
// channel got a new id when it became private. The old one is deleted in setupNotifications.
export const CHANNEL_ID = 'dose-reminders-private';
const OLD_CHANNEL_IDS = ['dose-reminders', 'refills'];
export const REFILL_CHANNEL_ID = 'refills-private';
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
      // Private: when the phone hides sensitive content on the lock screen, the reminder
      // still shows there but without its text. Unlocked, it shows in full.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: 'default',
      bypassDnd: false,
    });
    await Notifications.setNotificationChannelAsync(REFILL_CHANNEL_ID, {
      name: 'Refill alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    for (const id of OLD_CHANNEL_IDS) await Notifications.deleteNotificationChannelAsync(id).catch(() => {});
  }
  const snooze = repo.getSettings().snoozeMinutes;
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_TAKEN, buttonTitle: 'Taken', options: { opensAppToForeground: false } },
    { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${snooze} min`, options: { opensAppToForeground: false } },
    { identifier: ACTION_SKIP, buttonTitle: 'Skip', options: { opensAppToForeground: false, isDestructive: true } },
  ]);
  setupDone = true;
}

/** Call after the snooze length changes so the button label updates. */
export function resetNotificationSetup() {
  setupDone = false;
}

function contentFor(r: PlannedReminder, meds: Map<string, Medication>, showNames: boolean): Notifications.NotificationContentInput {
  const due = r.medIds.map((id) => meds.get(id)).filter((m): m is Medication => !!m);
  const { title, body } = reminderText(r, due, showNames);
  if (r.kind === 'missed') {
    return {
      title,
      body,
      data: { date: r.date, time: r.time, medIds: r.medIds, slots: r.slots, group: groupKey(r.date, 'missed') },
      categoryIdentifier: CATEGORY_ID,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      autoDismiss: true,
    };
  }
  return {
    title,
    body,
    data: { date: r.date, time: r.time, medIds: r.medIds, slots: r.slots },
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
      content: contentFor(r, byId, settings.showMedNames),
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
  /** Slot keys of the doses, in the same order as medIds. Older reminders don't have them. */
  slots: string[] | null;
  /** Which notification group to clear; defaults to the date and time. */
  group: string | null;
}

function readData(data: unknown): ReminderData | null {
  const d = data as Partial<ReminderData> | null;
  if (!d || typeof d.date !== 'string' || typeof d.time !== 'string' || !Array.isArray(d.medIds)) return null;
  const slots = Array.isArray(d.slots) && d.slots.length === d.medIds.length ? (d.slots as string[]) : null;
  return { date: d.date, time: d.time, medIds: d.medIds as string[], slots, group: typeof d.group === 'string' ? d.group : null };
}

/**
 * Handles a tap on Taken / Snooze / Skip. Runs both from the app and from the
 * background task (Android runs it even when the app is closed). Repeating it is harmless.
 */
export async function handleReminderAction(actionId: string, rawData: unknown) {
  const data = readData(rawData);
  if (!data) return;
  const group = data.group ?? groupKey(data.date, data.time);
  const now = new Date();

  if (actionId === ACTION_TAKEN || actionId === ACTION_SKIP) {
    const status = actionId === ACTION_TAKEN ? 'taken' : 'skipped';
    const low: Medication[] = [];
    // The doses as scheduled today, so each is logged with its own time.
    const today = new Map(dosesOn(repo.getMeds(), data.date).map((d) => [d.slot, d]));
    data.medIds.forEach((medId, i) => {
      const slot = data.slots?.[i] ?? slotKey(medId, data.date, data.time);
      if (repo.getLog(slot)) return; // already answered in the app
      const dose = today.get(slot) ?? { slot, medId, date: data.date, time: data.time };
      low.push(...repo.setDose(dose, status, now));
    });
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
        ...refillText(m.name, left, repo.getSettings().showMedNames),
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

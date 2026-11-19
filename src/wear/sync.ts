import { Platform } from 'react-native';
import { SabrWear } from '../../modules/sabr-wear';
import { toDateKey } from '../domain/dates';
import { computeProgress } from '../domain/progress';
import { dosesOn, dueAt, groupByTime, indexLogs } from '../domain/schedule';
import * as repo from '../db/repo';
import { ACTION_SNOOZE, ACTION_TAKEN, handleReminderAction } from '../notifications/reminders';
import { pushShare } from '../sync/engine';
import { refreshWidgetNow } from '../widget/update';
import { watchPayload } from './payload';

/** The watch tile, when it's switched on in Settings (off by default). */
function enabled() {
  return Platform.OS === 'android' && SabrWear != null && repo.getSettings().watchTile === true;
}

function todayPayload(now = new Date()) {
  const date = toDateKey(now);
  const settings = repo.getSettings();
  const meds = repo.getMeds();
  const snoozes = new Map<string, number>();
  for (const [group, until] of repo.getSnoozes()) {
    const t = new Date(until).getTime();
    if (t > now.getTime()) snoozes.set(group, t);
  }
  let streak = 0;
  try {
    streak = computeProgress(repo.getDaySummaries(date)).currentStreak;
  } catch {
    // keep 0
  }
  return watchPayload({
    date,
    now,
    doses: dosesOn(meds, date),
    logs: indexLogs(repo.getLogs(date, date)),
    names: new Map(meds.map((m) => [m.id, m.name])),
    streak,
    showNames: settings.showMedNames,
    snoozes,
    dueAt: (d, t) => dueAt(d, t),
  });
}

/** Sends today's doses to the watch tile right away. Does nothing while the tile is off. */
export async function pushToWatchNow() {
  if (!enabled()) return;
  await SabrWear!.sendToday(JSON.stringify(todayPayload())).catch((e) => console.warn('Could not update the watch', e));
}

/** Takes everything off the watch, for when the tile is switched off. */
export async function clearWatch() {
  if (Platform.OS !== 'android' || !SabrWear) return;
  await SabrWear.clear().catch(() => {});
}

export async function connectedWatches(): Promise<string[]> {
  if (Platform.OS !== 'android' || !SabrWear) return [];
  return SabrWear.connectedWatches().catch(() => []);
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Cheap to call often; calls are merged. */
function pushToWatch() {
  if (Platform.OS !== 'android' || !SabrWear) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    pushToWatchNow();
  }, 500);
}

// Any change to doses, meds or settings updates the tile.
repo.subscribe(pushToWatch);

/**
 * Runs when the watch tile's Taken or Snooze is pressed (or it asks for fresh data), even
 * with the app closed. The watch sends only the day and time it showed.
 */
export async function handleWatchAction(data: { action?: string; body?: string }) {
  if (!enabled()) return;
  try {
    if (data.action === 'take' || data.action === 'snooze') await applyWatchPress(data.action, data.body);
  } finally {
    // Always answer with the phone's real state: the tile shows a press straight away, so a
    // press the phone turned down (not due yet, a new day) must be undone on the watch.
    await pushToWatchNow();
  }
}

async function applyWatchPress(action: 'take' | 'snooze', body: string | undefined) {
  let req: { date?: unknown; time?: unknown };
  try {
    req = JSON.parse(body ?? '{}');
  } catch {
    return;
  }
  const now = new Date();
  if (typeof req.date !== 'string' || typeof req.time !== 'string' || req.date !== toDateKey(now)) return;
  const group = groupByTime(dosesOn(repo.getMeds(), req.date)).find((g) => g.time === req.time);
  // A minute of grace: the watch's clock may run slightly ahead of the phone's.
  if (!group || dueAt(req.date, req.time).getTime() > now.getTime() + 60_000) return;
  const open = group.doses.filter((d) => !repo.getLog(d.slot));
  if (open.length === 0) return;
  await handleReminderAction(action === 'take' ? ACTION_TAKEN : ACTION_SNOOZE, {
    date: req.date,
    time: req.time,
    medIds: open.map((d) => d.medId),
    slots: open.map((d) => d.slot),
  });
  // The app may not be running, so update everything that shows doses before finishing.
  await refreshWidgetNow().catch(() => {});
  await pushShare().catch(() => {});
}

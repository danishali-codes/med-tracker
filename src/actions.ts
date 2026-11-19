import { timeFromDate, toDateKey, type DateKey } from './domain/dates';
import { groupKey } from './domain/reminders';
import { dosesOn } from './domain/schedule';
import type { DoseStatus, Medication } from './domain/types';
import * as repo from './db/repo';
import { dismissGroup, notifyLowStock, rescheduleAll } from './notifications/reminders';
import { startFoodTimer } from './notifications/food';

/** Log, change or clear (null) a dose from inside the app, then refresh reminders. */
export async function logDose(
  dose: { slot: string; medId: string; date: DateKey; time: string },
  status: DoseStatus | null,
) {
  const low = repo.setDose(dose, status);
  if (status === 'taken') startFoodTimer([dose.medId]).catch(() => {});
  const group = groupKey(dose.date, dose.time);
  const stillPending = dosesOn(repo.getMeds(), dose.date).some((d) => d.time === dose.time && !repo.getLog(d.slot));
  if (!stillPending) {
    repo.clearSnooze(group);
    dismissGroup(group).catch(() => {});
  }
  await notifyLowStock(low).catch(() => {});
  await rescheduleAll().catch((e) => console.warn('reschedule failed', e));
}

/** As-needed meds: record a dose right now. */
export async function logAsNeeded(med: Medication) {
  const now = new Date();
  const date = toDateKey(now);
  const time = timeFromDate(now);
  const slot = `${med.id}|${date}|prn-${now.getTime()}`;
  const low = repo.setDose({ slot, medId: med.id, date, time }, 'taken', now);
  startFoodTimer([med.id], now).catch(() => {});
  await notifyLowStock(low).catch(() => {});
}

export async function saveMedication(med: Medication) {
  repo.saveMed(med);
  await rescheduleAll().catch((e) => console.warn('reschedule failed', e));
}

export async function removeMedication(id: string) {
  repo.deleteMed(id);
  await rescheduleAll().catch((e) => console.warn('reschedule failed', e));
}

/** Remind again in a few minutes for every dose due at this time. */
export async function snoozeDoses(date: DateKey, time: string, minutes: number) {
  const group = groupKey(date, time);
  repo.setSnooze(group, new Date(Date.now() + minutes * 60_000));
  await dismissGroup(group).catch(() => {});
  await rescheduleAll().catch((e) => console.warn('reschedule failed', e));
}

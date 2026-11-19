import { toDateKey } from '../domain/dates';
import * as repo from '../db/repo';
import { buildWidgetData, type WidgetData } from './model';

export * from './model';

export function widgetData(now = new Date()): WidgetData {
  const today = toDateKey(now);
  return buildWidgetData({
    now,
    meds: repo.getMeds(),
    logs: repo.getLogs(today, today),
    summaries: safe(() => repo.getDaySummaries(today), []),
    snoozes: safe(() => repo.getSnoozes(), new Map()),
    settings: repo.getSettings(),
  });
}

function safe<T>(f: () => T, fallback: T): T {
  try {
    return f();
  } catch {
    return fallback;
  }
}

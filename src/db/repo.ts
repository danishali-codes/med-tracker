import { getDb } from './database';
import { addDays, diffDays, eachDay, toDateKey, type DateKey } from '../domain/dates';
import { isLowStock, normalizeMed } from '../domain/dose';
import { summarizeDay, trackedFrom, type DaySummary } from '../domain/progress';
import { indexLogs } from '../domain/schedule';
import { DEFAULT_SETTINGS, type DoseLog, type DoseStatus, type Medication, type Settings } from '../domain/types';

// ---- change notifications so screens refresh after any write ----

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getVersion(): number {
  return version;
}

function changed() {
  version++;
  listeners.forEach((l) => l());
}

// ---- medications ----

export function getMeds(): Medication[] {
  const rows = getDb().getAllSync<{ data: string }>('SELECT data FROM meds ORDER BY created_at');
  return rows.map((r) => normalizeMed(JSON.parse(r.data)));
}

export function getMed(id: string): Medication | null {
  const row = getDb().getFirstSync<{ data: string }>('SELECT data FROM meds WHERE id = ?', id);
  return row ? normalizeMed(JSON.parse(row.data)) : null;
}

export function saveMed(med: Medication) {
  getDb().runSync(
    'INSERT OR REPLACE INTO meds (id, data, archived, created_at) VALUES (?, ?, ?, ?)',
    med.id,
    JSON.stringify(med),
    med.archived ? 1 : 0,
    med.createdAt,
  );
  // Today's and future days depend on the schedule; finished days stay as they were.
  changed();
}

/**
 * Deleting removes the med and its dose log. Finished days keep their summaries, so
 * past streaks and coins (for this and every other med) stay as they were.
 * Archiving (saveMed with archived) keeps the dose log too.
 */
export function deleteMed(id: string) {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM meds WHERE id = ?', id);
    db.runSync('DELETE FROM dose_log WHERE med_id = ?', id);
  });
  changed();
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---- dose log ----

interface LogRow {
  slot: string;
  med_id: string;
  date: string;
  time: string;
  status: string;
  at: string;
}

const toLog = (r: LogRow): DoseLog => ({
  slot: r.slot,
  medId: r.med_id,
  date: r.date,
  time: r.time,
  status: r.status as DoseStatus,
  at: r.at,
});

export function getLogs(from?: DateKey, to?: DateKey): DoseLog[] {
  const db = getDb();
  const rows =
    from && to
      ? db.getAllSync<LogRow>('SELECT * FROM dose_log WHERE date >= ? AND date <= ?', from, to)
      : db.getAllSync<LogRow>('SELECT * FROM dose_log');
  return rows.map(toLog);
}

export function getLog(slot: string): DoseLog | null {
  const row = getDb().getFirstSync<LogRow>('SELECT * FROM dose_log WHERE slot = ?', slot);
  return row ? toLog(row) : null;
}

/**
 * Record (or clear, with status null) a dose. Each "taken" uses the med's `amount`
 * units (e.g. 3 tablets) from stock, and returns meds whose stock just reached
 * their refill level.
 */
export function setDose(
  dose: { slot: string; medId: string; date: DateKey; time: string },
  status: DoseStatus | null,
  at: Date = new Date(),
): Medication[] {
  const db = getDb();
  const lowStock: Medication[] = [];
  db.withTransactionSync(() => {
    const prev = db.getFirstSync<LogRow & { stock_used: number }>('SELECT * FROM dose_log WHERE slot = ?', dose.slot);
    if (prev && prev.status === status) return; // already recorded (e.g. tapped in the notification and in the app)
    const med = getMed(dose.medId);
    const tracked = med != null && med.stock != null;
    let stock = med?.stock ?? 0;
    // Put back exactly what an earlier "taken" removed.
    if (prev?.status === 'taken' && tracked) stock += prev.stock_used;
    let used = 0;
    if (status === 'taken' && tracked) {
      used = Math.min(med!.amount, stock);
      stock = Math.round((stock - used) * 1000) / 1000;
    }
    if (status === null) {
      db.runSync('DELETE FROM dose_log WHERE slot = ?', dose.slot);
    } else {
      db.runSync(
        'INSERT OR REPLACE INTO dose_log (slot, med_id, date, time, status, at, stock_used) VALUES (?, ?, ?, ?, ?, ?, ?)',
        dose.slot,
        dose.medId,
        dose.date,
        dose.time,
        status,
        at.toISOString(),
        used,
      );
    }
    if (tracked && stock !== med!.stock) {
      const next = { ...med!, stock };
      db.runSync('UPDATE meds SET data = ? WHERE id = ?', JSON.stringify(next), med!.id);
      const crossed = status === 'taken' && !isLowStock(med!) && isLowStock(next);
      if (crossed) lowStock.push(next);
    }
    db.runSync('DELETE FROM day_summary WHERE date = ?', dose.date);
  });
  changed();
  return lowStock;
}

// ---- snoozes ----

export function getSnoozes(): Map<string, string> {
  const rows = getDb().getAllSync<{ grp: string; until: string }>('SELECT grp, until FROM snooze');
  return new Map(rows.map((r) => [r.grp, r.until]));
}

export function setSnooze(group: string, until: Date) {
  getDb().runSync('INSERT OR REPLACE INTO snooze (grp, until) VALUES (?, ?)', group, until.toISOString());
  changed();
}

export function clearSnooze(group: string) {
  getDb().runSync('DELETE FROM snooze WHERE grp = ?', group);
}

export function pruneSnoozes(today: DateKey) {
  getDb().runSync('DELETE FROM snooze WHERE grp < ?', addDays(today, -2));
}

// ---- settings and small values ----

export function getKv(key: string): string | null {
  return getDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key)?.value ?? null;
}

export function setKv(key: string, value: string) {
  getDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
  changed();
}

export function getSettings(): Settings {
  const raw = getKv('settings');
  return { ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
}

export function saveSettings(s: Settings) {
  // Finished days keep their summaries; a new on-time window applies from today on.
  getDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', 'settings', JSON.stringify(s));
  changed();
}

// ---- day summaries ----

/**
 * Summaries for every day from the first med's start to today. Finished days are
 * cached so later schedule edits don't rewrite history.
 */
export function getDaySummaries(today: DateKey = toDateKey(new Date())): DaySummary[] {
  const db = getDb();
  const meds = getMeds();
  // Saved summaries count too, so history survives deleting a med (even the last one).
  const firstCached = db.getFirstSync<{ d: string | null }>('SELECT MIN(date) AS d FROM day_summary')?.d ?? null;
  if (meds.length === 0 && !firstCached) return [];
  const fromMeds = meds.reduce((min, m) => (trackedFrom(m) < min ? trackedFrom(m) : min), today);
  const first = firstCached && firstCached < fromMeds ? firstCached : fromMeds;
  const start = diffDays(first, today) > 730 ? addDays(today, -730) : first;
  if (diffDays(start, today) < 0) return [];

  const cached = new Map(
    db.getAllSync<{ date: string; data: string }>('SELECT date, data FROM day_summary').map((r) => [r.date, JSON.parse(r.data) as DaySummary]),
  );
  const logs = indexLogs(getLogs(start, today));
  const settings = getSettings();
  const out: DaySummary[] = [];
  const toCache: DaySummary[] = [];
  for (const date of eachDay(start, today)) {
    const hit = cached.get(date);
    if (hit && date !== today) {
      out.push(hit);
      continue;
    }
    const s = summarizeDay(meds, logs, date, today, settings.onTimeWindowMinutes);
    out.push(s);
    if (date !== today) toCache.push(s);
  }
  if (toCache.length) {
    db.withTransactionSync(() => {
      for (const s of toCache) db.runSync('INSERT OR REPLACE INTO day_summary (date, data) VALUES (?, ?)', s.date, JSON.stringify(s));
    });
  }
  return out;
}

// ---- backup ----

// day_summary is included: it holds finished days as they were, which can't be rebuilt
// once a med has been archived or its schedule changed. purchase and placement belong to
// the room decorating, which is switched off for now; they stay so nothing is lost.
const TABLES = ['meds', 'dose_log', 'day_summary', 'snooze', 'purchase', 'placement', 'kv'] as const;

export function exportAll(): string {
  const db = getDb();
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = db.getAllSync(`SELECT * FROM ${t}`);
  return JSON.stringify({ app: 'med-tracker', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function importAll(json: string) {
  const parsed = JSON.parse(json) as { app?: string; data?: Record<string, Record<string, unknown>[]> };
  if (parsed.app !== 'med-tracker' || !parsed.data) throw new Error('This is not a Med Tracker backup file.');
  const db = getDb();
  db.withTransactionSync(() => {
    for (const t of TABLES) {
      db.runSync(`DELETE FROM ${t}`);
      for (const row of parsed.data![t] ?? []) {
        const cols = Object.keys(row);
        if (cols.length === 0 || !cols.every((c) => /^[a-z_]+$/.test(c))) continue;
        db.runSync(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c] as string | number | null),
        );
      }
    }
  });
  changed();
}

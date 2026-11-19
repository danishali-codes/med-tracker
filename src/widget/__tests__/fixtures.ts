import type { DaySummary } from '../../domain/progress';
import { slotKey } from '../../domain/schedule';
import type { DoseLog, Medication } from '../../domain/types';
import { buildWidgetData, type WidgetData } from '../model';

const med = (id: string, name: string, times: string[], look: Partial<Medication>): Medication => ({
  id,
  name,
  strength: '500 mg',
  amount: 1,
  form: 'pill',
  color: '#6A4DF4',
  schedule: { pattern: { kind: 'daily' }, times, startDate: '2026-11-01' },
  stock: null,
  refillAt: null,
  archived: false,
  createdAt: '2026-11-01T00:00:00Z',
  ...look,
});

export const MEDS: Medication[] = [
  med('a', 'Metformin', ['08:00', '21:00'], { shape: 'oval', pillColor: '#FFFFFF' }),
  med('b', 'Omeprazole', ['08:00'], { form: 'capsule', strength: '20 mg', shape: 'capsule', pillColor: '#A98BE8', pillColor2: '#F49AB6' }),
  med('c', 'Atorvastatin', ['21:00'], { strength: '20 mg', shape: 'round', pillColor: '#FBE37A' }),
];

const DATE = '2026-11-19';
const at = (hh: number, mm = 0) => new Date(2026, 10, 19, hh, mm);
const log = (medId: string, time: string, when: Date, status: DoseLog['status'] = 'taken'): DoseLog => ({
  slot: slotKey(medId, DATE, time),
  medId,
  date: DATE,
  time,
  status,
  at: when.toISOString(),
});

/** Six good days before today, so there's a streak. */
const PAST: DaySummary[] = [13, 14, 15, 16, 17, 18].map((d) => ({
  date: `2026-11-${d}`,
  scheduled: 4,
  taken: 4,
  onTime: 4,
  late: 0,
  skipped: 0,
  status: 'complete',
}));

function build(now: Date, logs: DoseLog[], opts: { names?: boolean; snoozed?: boolean; meds?: Medication[] } = {}): WidgetData {
  const meds = opts.meds ?? MEDS;
  const done = logs.length;
  const today: DaySummary = {
    date: DATE,
    scheduled: 4,
    taken: logs.filter((l) => l.status === 'taken').length,
    onTime: logs.filter((l) => l.status === 'taken').length,
    late: 0,
    skipped: logs.filter((l) => l.status === 'skipped').length,
    status: done === 4 ? 'complete' : 'pending',
  } as DaySummary;
  return buildWidgetData({
    now,
    meds,
    logs,
    summaries: meds.length ? [...PAST, today] : [],
    snoozes: opts.snoozed ? new Map([[`${DATE}|08:00`, new Date(now.getTime() + 8 * 60_000).toISOString()]]) : new Map(),
    settings: { onTimeWindowMinutes: 60, snoozeMinutes: 10, widgetShowNames: !!opts.names },
  });
}

const allTaken = (late: boolean) => [
  log('a', '08:00', at(8, 5)),
  log('b', '08:00', at(8, 5)),
  log('a', '21:00', late ? at(22, 40) : at(21, 10)),
  log('c', '21:00', late ? at(22, 40) : at(21, 10)),
];

/** Every state the widgets can be in. */
export const SCENARIOS: Record<string, WidgetData> = {
  due: build(at(8, 20), []),
  dueNames: build(at(8, 20), [], { names: true }),
  partlyDone: build(at(8, 20), [log('a', '08:00', at(8, 10))], { names: true }),
  snoozed: build(at(8, 20), [], { snoozed: true }),
  later: build(at(13, 0), [log('a', '08:00', at(8, 5)), log('b', '08:00', at(8, 5))]),
  done: build(at(23, 0), allTaken(true)),
  gold: build(at(23, 0), allTaken(false)),
  empty: build(at(10, 0), [], { meds: [] }),
};

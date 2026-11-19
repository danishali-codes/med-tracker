import { describe, expect, it } from 'vitest';
import { buildReport, reportHtml } from '../report';
import { slotKey } from '../schedule';
import type { DoseLog, Medication } from '../types';

const med: Medication = {
  id: 'a',
  name: 'Metformin',
  generic: 'metformin',
  strength: '500 mg',
  amount: 1,
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times: ['08:00', '20:00'], startDate: '2026-11-01' },
  stock: null,
  refillAt: null,
  archived: false,
  createdAt: '2026-11-01T00:00:00',
};
const log = (date: string, time: string, status: DoseLog['status'], at: string): DoseLog => ({ slot: slotKey('a', date, time), medId: 'a', date, time, status, at: new Date(at).toISOString() });

describe('buildReport', () => {
  const logs = [
    log('2026-11-10', '08:00', 'taken', '2026-11-10T08:05:00'),
    log('2026-11-10', '20:00', 'taken', '2026-11-10T22:30:00'), // late
    log('2026-11-11', '08:00', 'skipped', '2026-11-11T08:00:00'),
    // 11-11 20:00 missed
    log('2026-11-12', '08:00', 'taken', '2026-11-12T08:00:00'),
  ];
  const r = buildReport({
    meds: [med],
    logs,
    notes: [{ date: '2026-11-11', mood: 2, symptoms: ['Nausea', 'Tired'], text: 'Felt sick' }, { date: '2026-11-12', mood: 4, symptoms: ['Tired'], text: '' }],
    from: '2026-11-10',
    to: '2026-11-12',
    now: new Date('2026-11-12T12:00:00'),
    windowMinutes: 60,
  });
  it('counts taken, late, skipped and missed, and leaves out doses not due yet', () => {
    const m = r.meds[0];
    expect([m.due, m.taken, m.onTime, m.late, m.skipped, m.missed]).toEqual([5, 3, 2, 1, 1, 1]);
    expect(m.adherence).toBeCloseTo(3 / 4);
    expect(m.missedDoses).toEqual([{ date: '2026-11-11', time: '20:00' }]);
  });
  it('summarises notes', () => {
    expect(r.symptoms).toEqual([
      { name: 'Tired', days: 2 },
      { name: 'Nausea', days: 1 },
    ]);
    expect(r.averageMood).toBe(3);
  });
  it('renders escaped HTML', () => {
    const html = reportHtml({ ...r, notes: [{ date: '2026-11-11', mood: 1, symptoms: [], text: '<script>' }] }, { generatedAt: new Date(), windowMinutes: 60 });
    expect(html).toContain('Metformin');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

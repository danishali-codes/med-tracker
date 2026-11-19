// Screenshot builds only. The screenshots workflow copies this file into the app as
// src/demo-seed.ts and imports it first from index.ts, so the app opens with a few
// weeks of realistic history. It uses only functions that exist in every version
// (0.1 onwards), and fills in both the old (dose, perDose) and new (strength, amount)
// medication fields so each version reads the ones it knows.
import { getKv, getMeds, saveMed, setDose, setKv } from './db/repo';
import { addDays, atTime, eachDay, toDateKey } from './domain/dates';
import { dosesOn } from './domain/schedule';

const DAYS = 45;

function seed() {
  if (getKv('demo_seeded')) return;
  const now = new Date();
  const today = toDateKey(now);
  const start = addDays(today, -DAYS);
  const createdAt = atTime(start, '07:00').toISOString();
  const base = { archived: false, archivedAt: null, createdAt, notes: '' };
  const meds = [
    { id: 'demo-metformin', name: 'Metformin', generic: 'metformin', dose: '500 mg', strength: '500 mg', amount: 1, perDose: 1, form: 'pill', shape: 'oblong', pillColor: '#FFFFFF', color: '#6A4DF4', stock: 48, refillAt: 14,
      schedule: { pattern: { kind: 'daily' }, times: ['08:00', '20:00'], startDate: start, dayTimes: [{ days: [1, 2], times: ['06:45', '20:00'] }, { days: [5, 6], times: ['10:00', '22:00'] }] } },
    { id: 'demo-omeprazole', name: 'Omeprazole', generic: 'omeprazole', dose: '20 mg', strength: '20 mg', amount: 1, perDose: 1, form: 'capsule', shape: 'capsule', pillColor: '#A98BE8', pillColor2: '#F49AB6', color: '#16B582', stock: 9, refillAt: 10,
      schedule: { pattern: { kind: 'daily' }, times: ['07:30'], startDate: start } },
    { id: 'demo-atorvastatin', name: 'Atorvastatin', generic: 'atorvastatin', dose: '20 mg', strength: '20 mg', amount: 1, perDose: 1, form: 'pill', shape: 'oval', pillColor: '#FBE37A', color: '#F29D0C', stock: 26, refillAt: 7,
      schedule: { pattern: { kind: 'daily' }, times: ['21:00'], startDate: start } },
    { id: 'demo-vitd', name: 'Vitamin D3', generic: 'cholecalciferol', dose: '50,000 IU', strength: '50,000 IU', amount: 1, perDose: 1, form: 'capsule', shape: 'oval', pillColor: '#F7A541', color: '#3AB7F0', stock: null, refillAt: null,
      schedule: { pattern: { kind: 'weekdays', days: [5] }, times: ['10:00'], startDate: start } },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of meds) saveMed({ ...base, ...m } as any);

  // Fixed pseudo-random sequence so every version gets the same history.
  let r = 7;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  const all = getMeds();
  const missedDay = addDays(today, -19);
  for (const date of eachDay(start, today)) {
    for (const d of dosesOn(all, date)) {
      const due = atTime(date, d.time);
      if (due > now) continue;
      if (date === missedDay && d.time >= '20:00') continue; // one missed evening, used by a freeze
      const roll = rand();
      if (roll < 0.03) {
        setDose(d, 'skipped', due);
        continue;
      }
      const lateMin = roll > 0.85 ? 40 + Math.floor(rand() * 90) : Math.floor(rand() * 20) - 5;
      setDose(d, 'taken', new Date(Math.min(due.getTime() + lateMin * 60000, now.getTime())));
    }
  }
  // A note for today, where the version has notes (0.3 onwards).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const repo = require('./db/repo');
    if (typeof repo.saveNote === 'function') {
      // A few weeks of mood notes so Patterns and the month review have something to show (0.6 onwards).
      for (let i = 1; i <= 30; i++) {
        const date = addDays(today, -i);
        const roll = rand();
        const mood = date === addDays(missedDay, 1) || roll < 0.15 ? 2 : roll < 0.5 ? 3 : 4;
        repo.saveNote({ date, mood, symptoms: mood === 2 ? ['Tired', 'Headache'] : roll > 0.9 ? ['Tired'] : [], text: '' });
      }
      repo.saveNote({ date: today, mood: 4, symptoms: ['Tired'], text: 'Slept badly, felt fine after lunch.' });
    }
  } catch {
    // older versions have no notes
  }
  setKv('demo_seeded', '1');
}

try {
  seed();
} catch (e) {
  console.error('demo seed failed', e);
}

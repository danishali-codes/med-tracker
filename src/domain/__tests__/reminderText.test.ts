import { describe, expect, it } from 'vitest';
import { refillText, reminderText } from '../reminders';
import { DEFAULT_SETTINGS } from '../types';

const meds = [
  { name: 'Glucophage', strength: '500 mg', amount: 1, form: 'tablet' },
  { name: 'Concor', strength: '5 mg', amount: 1, form: 'tablet' },
] as never[];

describe('reminder privacy', () => {
  it('hides names by default', () => {
    expect(DEFAULT_SETTINGS.showMedNames).toBe(false);
    for (const kind of ['due', 'snoozed', 'nag'] as const) {
      const t = reminderText({ kind, time: '08:00' }, meds, false);
      expect(`${t.title} ${t.body}`).not.toMatch(/Glucophage|Concor|mg/);
    }
    expect(reminderText({ kind: 'due', time: '08:00' }, meds, false).body).toBe('2 medicines to take');
    expect(reminderText({ kind: 'due', time: '08:00' }, meds.slice(0, 1), false).body).toBe('1 medicine to take');
    const r = refillText('Glucophage', '5 tablets left', false);
    expect(`${r.title} ${r.body}`).not.toMatch(/Glucophage/);
  });

  it('shows names once turned on', () => {
    expect(reminderText({ kind: 'due', time: '08:00' }, meds.slice(0, 1), true).title).toBe('Time for Glucophage');
    expect(reminderText({ kind: 'due', time: '08:00' }, meds, true).body).toMatch(/Glucophage.*Concor/);
    expect(refillText('Glucophage', '5 tablets left', true).title).toBe('Running low on Glucophage');
  });
});

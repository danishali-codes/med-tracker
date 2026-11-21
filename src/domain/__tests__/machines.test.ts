import { describe, expect, it } from 'vitest';
import { describeDose } from '../dose';
import { describeNight, everyText, machineUsage, markPartChanged, parseHours, partDueText, partsDue, planPartReminders, partReminderText } from '../machines';
import { summarizeDay } from '../progress';
import { planReminders, reminderText } from '../reminders';
import { slotKey } from '../schedule';
import { buildStatus } from '../../sync/status';
import { countsForStreak, DEFAULT_SETTINGS, type DoseLog, type Medication } from '../types';

const pill: Medication = {
  id: 'pill',
  name: 'Metformin',
  strength: '500 mg',
  amount: 1,
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times: ['22:30'], startDate: '2026-11-01' },
  stock: null,
  refillAt: null,
  archived: false,
  createdAt: '2026-11-01T00:00:00Z',
};

const cpap: Medication = {
  ...pill,
  id: 'cpap',
  name: 'CPAP',
  strength: '',
  form: 'other',
  machine: {
    type: 'cpap',
    parts: [
      { id: 'cushion', name: 'Mask cushion', everyDays: 14, lastChanged: '2026-11-07' },
      { id: 'tube', name: 'Tubing', everyDays: 90, lastChanged: '2026-11-01' },
    ],
  },
};

const log = (med: Medication, date: string, status: DoseLog['status'] = 'taken'): DoseLog => ({
  slot: slotKey(med.id, date, '22:30'),
  medId: med.id,
  date,
  time: '22:30',
  status,
  at: `${date}T22:35:00`,
});

describe('machines', () => {
  it('never count towards the streak', () => {
    expect(countsForStreak(cpap)).toBe(false);
    expect(countsForStreak(pill)).toBe(true);
    // Only the CPAP is due and it wasn't used: the day has nothing scheduled, so it can't be missed.
    const day = summarizeDay([cpap], new Map(), '2026-11-10', '2026-11-12', 60);
    expect(day.scheduled).toBe(0);
    const both = summarizeDay([cpap, pill], new Map([[log(pill, '2026-11-10').slot, log(pill, '2026-11-10')]]), '2026-11-10', '2026-11-12', 60);
    expect(both.scheduled).toBe(1);
    expect(both.status).toBe('complete');
  });

  it('read as a check-in, not a dose', () => {
    expect(describeDose(cpap)).toBe('Nightly check-in');
    expect(describeDose({ ...cpap, schedule: { ...cpap.schedule, pattern: { kind: 'asNeeded' }, times: [] } })).toBe('Log when used');
  });

  it('get one gentle reminder, and stay out of the evening check', () => {
    const plan = planReminders({
      meds: [cpap],
      logs: new Map(),
      snoozes: new Map(),
      now: new Date(2026, 10, 17, 7, 0),
      settings: { ...DEFAULT_SETTINGS, nagEnabled: true, nagCount: 3, missedNotice: true, missedNoticeAt: '23:30' },
      horizonDays: 0,
      maxCount: 100,
    });
    expect(plan.map((r) => r.kind)).toEqual(['due']);
  });

  it('remind without saying what the machine is unless names are on', () => {
    const hidden = reminderText({ kind: 'due', time: '22:30' }, [cpap], false);
    expect(hidden.title).toBe('Time for your 10:30 PM check-in');
    expect(JSON.stringify(hidden)).not.toMatch(/CPAP/);
    expect(reminderText({ kind: 'due', time: '22:30' }, [cpap], true).title).toBe('Time for your CPAP');
  });

  it('are never shared with people who follow you', () => {
    const status = buildStatus({ meds: [cpap, pill], logs: new Map(), today: '2026-11-10', now: new Date(2026, 10, 10, 23), name: 'Me', showNames: false });
    expect(status.doses.every((d) => d.label === 'Medicine A')).toBe(true);
  });
});

describe('machine parts', () => {
  it('work out when each part is due', () => {
    expect(partDueText(cpap.machine!.parts[0], '2026-11-21')).toBe('Due today');
    expect(partDueText(cpap.machine!.parts[0], '2026-11-23')).toBe('2 days overdue');
    expect(partDueText(cpap.machine!.parts[0], '2026-11-16')).toBe('In 5 days');
    expect(partDueText(cpap.machine!.parts[1], '2026-11-21')).toBe('In 2 months');
    expect(partsDue([cpap], '2026-11-21').map((d) => d.part.id)).toEqual(['cushion']);
    expect(partsDue([{ ...cpap, archived: true }], '2026-11-21')).toEqual([]);
  });

  it('move on when a part is changed', () => {
    const next = markPartChanged(cpap, 'cushion', '2026-11-21');
    expect(next.machine!.parts[0].lastChanged).toBe('2026-11-21');
    expect(next.machine!.parts[1]).toEqual(cpap.machine!.parts[1]);
    expect(partsDue([next], '2026-11-21')).toEqual([]);
  });

  it('remind on the due day at the check-in time', () => {
    const plan = planPartReminders([cpap], new Date(2026, 10, 20, 12), 60);
    expect(plan).toHaveLength(1);
    expect(plan[0].id).toBe('part:cpap|cushion');
    expect(plan[0].at).toEqual(new Date(2026, 10, 21, 22, 30));
    // Past due: nothing to schedule (it shows on Today instead).
    expect(planPartReminders([cpap], new Date(2026, 10, 22, 12), 60)).toHaveLength(0);
  });

  it('keep part names off the lock screen by default', () => {
    expect(partReminderText('CPAP', 'Mask cushion', false).title).toBe('A part is due for a change');
    expect(partReminderText('CPAP', 'Mask cushion', true).title).toBe('Time to change your CPAP mask cushion');
  });

  it('describe intervals plainly', () => {
    expect(everyText(14)).toBe('Every 2 weeks');
    expect(everyText(30)).toBe('Every month');
    expect(everyText(90)).toBe('Every 3 months');
    expect(everyText(10)).toBe('Every 10 days');
  });
});

describe('machine nights', () => {
  it('sum up usage, hours and AHI', () => {
    const logs = new Map([log(cpap, '2026-11-10'), log(cpap, '2026-11-11'), log(cpap, '2026-11-12', 'skipped')].map((l) => [l.slot, l]));
    const nights = [
      { medId: 'cpap', date: '2026-11-10', hours: 6.5, ahi: 2.1 },
      { medId: 'cpap', date: '2026-11-11', hours: 3.5, ahi: 3.1, mask: 'leaky' as const },
      { medId: 'other', date: '2026-11-11', hours: 9 },
    ];
    expect(machineUsage(cpap, logs, nights, '2026-11-10', '2026-11-13')).toEqual({
      due: 4,
      used: 2,
      avgHours: 5,
      fourHourNights: 1,
      nightsWithHours: 2,
      avgAhi: 2.6,
    });
  });

  it('read hours typed in different ways', () => {
    expect(parseHours('6.5')).toBe(6.5);
    expect(parseHours('6,5')).toBe(6.5);
    expect(parseHours('6:30')).toBe(6.5);
    expect(parseHours('')).toBeNull();
    expect(parseHours('30')).toBeNull();
    expect(describeNight({ medId: 'cpap', date: '2026-11-10', hours: 6.5, ahi: 2.1, mask: 'some' })).toBe('6.5 h · AHI 2.1 · Some leaks');
  });
});

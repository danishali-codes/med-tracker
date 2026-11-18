import { describe, expect, it } from 'vitest';
import { daysOfSupply, describeDose, formatAmount, isLowStock, normalizeMed, parseAmount, unitsPerDay } from '../dose';
import type { Medication } from '../types';

const base: Medication = {
  id: 'a',
  name: 'Metformin',
  strength: '500 mg',
  amount: 3,
  form: 'pill',
  color: '#000',
  schedule: { pattern: { kind: 'daily' }, times: ['08:00', '20:00'], startDate: '2026-11-01' },
  stock: 60,
  refillAt: 12,
  archived: false,
  createdAt: '2026-11-01T00:00:00Z',
};

describe('dose', () => {
  it('describes strength and amount', () => {
    expect(describeDose(base)).toBe('500 mg · 3 tablets');
    expect(describeDose({ ...base, amount: 1 })).toBe('500 mg · 1 tablet');
    expect(describeDose({ ...base, strength: '', amount: 0.5 })).toBe('½ tablet');
    expect(describeDose({ ...base, form: 'liquid', strength: '5 mg/ml', amount: 7.5 })).toBe('5 mg/ml · 7.5 ml');
  });

  it('parses amounts', () => {
    expect(parseAmount('3')).toBe(3);
    expect(parseAmount('1/2')).toBe(0.5);
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('½')).toBe(0.5);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(formatAmount(1.5)).toBe('1½');
  });

  it('counts supply in units', () => {
    expect(unitsPerDay(base)).toBe(6);
    expect(daysOfSupply(base)).toBe(10);
    const weekly = { ...base, schedule: { ...base.schedule, pattern: { kind: 'interval' as const, every: 2, unit: 'week' as const }, times: ['08:00'] } };
    expect(daysOfSupply({ ...weekly, amount: 1, stock: 4 })).toBe(56);
  });

  it('flags low stock when the next dose cannot be covered', () => {
    expect(isLowStock(base)).toBe(false);
    expect(isLowStock({ ...base, stock: 12 })).toBe(true);
    expect(isLowStock({ ...base, stock: 2, refillAt: null })).toBe(true);
    expect(isLowStock({ ...base, stock: null })).toBe(false);
  });

  it('upgrades meds saved by v0.1', () => {
    const old = { ...base, strength: undefined, amount: undefined, dose: '250 mg', perDose: 2 } as unknown as Medication;
    const m = normalizeMed(old);
    expect(m.strength).toBe('250 mg');
    expect(m.amount).toBe(2);
    expect('dose' in m).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { parseStrengths, rankNames } from '../rank';

describe('medicine search', () => {
  it('ranks prefix matches first and keeps built-in entries', () => {
    const hits = rankNames('pan', [{ name: 'Panadol', generic: 'paracetamol' }, { name: 'Controloc', generic: 'pantoprazole' }], ['pantoprazole', 'Panadol', 'Span-K']);
    expect(hits.map((h) => h.name)).toEqual(['Panadol', 'pantoprazole', 'Span-K']);
    expect(hits[0].generic).toBe('paracetamol');
  });

  it('ignores one-letter queries', () => {
    expect(rankNames('p', [{ name: 'Panadol', generic: 'paracetamol' }], [])).toEqual([]);
  });

  it('parses strengths and forms from RxNorm names', () => {
    const opts = parseStrengths([
      'atorvastatin 80 MG Oral Tablet [Lipitor]',
      'atorvastatin 10 MG Oral Tablet',
      'amlodipine 5 MG / valsartan 160 MG Oral Tablet',
      'amoxicillin 50 MG/ML Oral Suspension',
    ]);
    expect(opts.map((o) => o.strength)).toEqual(['50 mg/ml', '5 mg + 160 mg', '10 mg', '80 mg']);
    expect(opts[0].form).toBe('liquid');
    expect(opts[1].form).toBe('pill');
  });
});

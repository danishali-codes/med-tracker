import { describe, expect, it } from 'vitest';
import { guessFromBox, productCode } from '../scan';

describe('guessFromBox', () => {
  it('reads a typical UAE box', () => {
    const g = guessFromBox(['GSK', 'Panadol', 'Advance', 'Paracetamol 500 mg', '24 film-coated tablets', 'Keep out of reach of children']);
    expect(g).toEqual({ name: 'Panadol', generic: 'paracetamol', strength: '500 mg', form: 'pill', packCount: 24 });
  });
  it('falls back to the first name-like line', () => {
    const g = guessFromBox(['ZORVEXA', 'Each capsule contains 20mg', '30 Capsules']);
    expect(g.name).toBe('Zorvexa');
    expect(g.strength).toBe('20 mg');
    expect(g.form).toBe('capsule');
    expect(g.packCount).toBe(30);
  });
  it('reads liquids per ml', () => {
    const g = guessFromBox(['Amoxil', 'Amoxicillin 250mg/5ml', 'Powder for oral suspension', '100 ml']);
    expect(g.strength).toBe('250 mg/5 ml');
    expect(g.form).toBe('liquid');
  });
});

describe('productCode', () => {
  it('keeps only the GTIN from a GS1 DataMatrix', () => {
    expect(productCode('0106291101234567' + '17271231' + '10ABC123' + '\u001d' + '21XYZ')).toBe('06291101234567');
    expect(productCode('(01)06291101234567(17)271231')).toBe('06291101234567');
  });
  it('pads EAN and UPC codes', () => {
    expect(productCode('6291101234567')).toBe('06291101234567');
    expect(productCode('')).toBeNull();
  });
});

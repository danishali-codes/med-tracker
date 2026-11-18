import { describe, expect, it } from 'vitest';
import { ingredientsOf, knownNotes, notesFromLabel, sentences } from '../interactions';

const med = (id: string, name: string, generic?: string) => ({ id, name, ingredients: ingredientsOf(name, generic) });

describe('interactions', () => {
  it('splits ingredient names', () => {
    expect(ingredientsOf('Exforge', 'amlodipine / valsartan')).toEqual(['amlodipine', 'valsartan']);
    expect(ingredientsOf('Glucophage', 'metformin hydrochloride')).toEqual(['metformin']);
    expect(ingredientsOf('Panadol 500 mg')).toEqual(['panadol']);
  });

  it('finds known alcohol, food and pair notes', () => {
    const notes = knownNotes([med('1', 'Flagyl', 'metronidazole'), med('2', 'Viagra', 'sildenafil'), med('3', 'Imdur', 'isosorbide mononitrate')]);
    expect(notes.some((n) => n.kind === 'alcohol' && n.text.startsWith('Flagyl'))).toBe(true);
    const pair = notes.find((n) => n.kind === 'medicine');
    expect(pair?.between).toEqual(['Viagra', 'Imdur']);
    expect(pair?.serious).toBe(true);
  });

  it('reads alcohol, food and other-med sentences from a label', () => {
    const label = {
      drug_interactions: [
        'Warfarin: Metronidazole has been reported to potentiate the anticoagulant effect of warfarin. Some other unrelated sentence here that is long enough.',
      ],
      information_for_patients: ['Discontinue consumption of alcoholic beverages while taking metronidazole and for at least three days afterward.'],
      dosage_and_administration: ['Take with food to reduce stomach upset from this medicine.'],
      warnings: ['Report this to the Food and Drug Administration if anything happens to you at all.'],
    };
    const notes = notesFromLabel(med('1', 'Flagyl', 'metronidazole'), label, [med('2', 'Coumadin', 'warfarin')]);
    expect(notes.find((n) => n.kind === 'medicine')?.between).toEqual(['Flagyl', 'Coumadin']);
    expect(notes.filter((n) => n.kind === 'alcohol')).toHaveLength(1);
    expect(notes.filter((n) => n.kind === 'food').map((n) => n.text)).toEqual(['Take with food to reduce stomach upset from this medicine.']);
  });

  it('splits sentences', () => {
    expect(sentences('First sentence is quite long here. Second one is long enough too.')).toHaveLength(2);
  });
});

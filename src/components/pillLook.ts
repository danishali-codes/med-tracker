import type { MedForm, Medication, PillShape } from '../domain/types';

/** Forms that can take a pill shape. Other forms are drawn as their container. */
export const hasShape = (form: MedForm) => form === 'pill' || form === 'capsule';

export function defaultShape(form: MedForm): PillShape {
  return form === 'capsule' ? 'capsule' : 'round';
}

/** The look stored on a med, with defaults for meds saved before shapes existed. */
export function lookOf(med: Pick<Medication, 'form' | 'shape' | 'pillColor' | 'pillColor2' | 'color'>): {
  form: MedForm;
  shape: PillShape;
  color: string;
  color2: string | null;
} {
  return {
    form: med.form,
    shape: med.shape ?? defaultShape(med.form),
    color: med.pillColor ?? (hasShape(med.form) ? '#FFFFFF' : med.color),
    color2: med.pillColor2 ?? null,
  };
}

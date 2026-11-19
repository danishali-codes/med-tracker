import { ingredientsOf, knownNotes, notesFromLabel, type CheckedMed, type InteractionNote } from '../domain/interactions';
import type { Medication } from '../domain/types';
import { fetchLabel } from './online';

export interface CheckResult {
  notes: InteractionNote[];
  /** Medicines whose label couldn't be read (offline or not in the US database). */
  missing: string[];
}

function toChecked(m: Pick<Medication, 'id' | 'name' | 'generic'>): CheckedMed {
  return { id: m.id, name: m.name, ingredients: ingredientsOf(m.name, m.generic) };
}

/**
 * Interaction notes for `focus` (or every med when focus is null) against the rest of `meds`.
 */
export async function checkInteractions(meds: Medication[], focusId: string | null): Promise<CheckResult> {
  const all = meds.map(toChecked);
  const targets = focusId ? all.filter((m) => m.id === focusId) : all;
  const known = knownNotes(all).filter(
    (n) => !focusId || (n.between ? n.between.includes(targets[0]?.name) : n.text.startsWith(`${targets[0]?.name}:`)),
  );
  const notes: InteractionNote[] = [...known];
  const missing: string[] = [];
  for (const m of targets) {
    let found = false;
    for (const ing of m.ingredients) {
      const label = await fetchLabel(ing);
      if (!label) continue;
      found = true;
      notes.push(...notesFromLabel(m, label, all.filter((o) => o.id !== m.id)));
    }
    if (!found) missing.push(m.name);
  }
  // Serious first, then pairs, alcohol, food.
  const order = { medicine: 0, alcohol: 1, food: 2 };
  notes.sort((a, b) => Number(!!b.serious) - Number(!!a.serious) || order[a.kind] - order[b.kind]);
  return { notes, missing };
}

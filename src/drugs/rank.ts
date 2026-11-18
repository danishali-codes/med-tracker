import type { MedForm } from '../domain/types';

export interface NameHit {
  name: string;
  /** Known active ingredient(s); null until looked up. */
  generic: string | null;
  source: 'builtin' | 'rxnorm';
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Ranks medicine names for a typed query: names starting with it first, then names
 * with a word starting with it, then names containing it. Built-in entries win ties
 * and duplicates (they carry the ingredient).
 */
export function rankNames(query: string, builtin: { name: string; generic: string }[], remote: string[], limit = 12): NameHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const score = (name: string) => {
    const n = norm(name);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(' ').some((w) => w.startsWith(q))) return 2;
    if (n.includes(q)) return 3;
    return -1;
  };
  const seen = new Set<string>();
  const hits: (NameHit & { s: number })[] = [];
  for (const b of builtin) {
    const s = score(b.name);
    if (s < 0 || seen.has(norm(b.name))) continue;
    seen.add(norm(b.name));
    hits.push({ name: b.name, generic: b.generic, source: 'builtin', s });
  }
  for (const r of remote) {
    const s = score(r);
    if (s < 0 || seen.has(norm(r))) continue;
    seen.add(norm(r));
    hits.push({ name: r, generic: null, source: 'rxnorm', s: s + 0.5 });
    if (hits.length > 400) break;
  }
  return hits
    .sort((a, b) => a.s - b.s || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ s: _s, ...h }) => h);
}

export interface StrengthOption {
  strength: string;
  form: MedForm;
  label: string;
}

const UNIT_MAP: Record<string, string> = { MG: 'mg', MCG: 'mcg', G: 'g', ML: 'ml', UNT: 'units', MEQ: 'mEq', '%': '%' };

function formOf(doseForm: string): MedForm {
  const f = doseForm.toLowerCase();
  if (f.includes('capsule')) return 'capsule';
  if (f.includes('tablet') || f.includes('lozenge')) return 'pill';
  if (f.includes('inhal')) return 'inhaler';
  if (f.includes('inject') || /\bpen\b/.test(f) || f.includes('prefilled syringe')) return 'injection';
  if (f.includes('ophthalmic') || f.includes('otic') || f.includes('drops')) return 'drops';
  if (f.includes('transdermal') || f.includes('patch')) return 'patch';
  if (f.includes('cream') || f.includes('ointment') || f.includes('gel') || f.includes('topical')) return 'cream';
  if (f.includes('powder') || f.includes('granules')) return 'sachet';
  if (f.includes('solution') || f.includes('suspension') || f.includes('syrup') || f.includes('liquid')) return 'liquid';
  return 'other';
}

/**
 * Turns RxNorm drug names like "amlodipine 5 MG / valsartan 160 MG Oral Tablet" or
 * "atorvastatin 10 MG Oral Tablet [Lipitor]" into strength and form choices.
 */
export function parseStrengths(names: string[], limit = 10): StrengthOption[] {
  const out: StrengthOption[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.replace(/\s*\[[^\]]*\]\s*$/, '').replace(/^\d+ ML /, '');
    const amounts = [...name.matchAll(/(\d+(?:\.\d+)?)\s*(MG|MCG|G|ML|UNT|MEQ|%)(?:\/(ML|ACTUAT|HR))?\b/g)];
    if (!amounts.length) continue;
    const strength = amounts
      .map((m) => `${m[1]} ${UNIT_MAP[m[2]] ?? m[2].toLowerCase()}${m[3] ? `/${m[3] === 'ACTUAT' ? 'puff' : m[3].toLowerCase()}` : ''}`)
      .join(' + ');
    const last = amounts[amounts.length - 1];
    const doseForm = name.slice((last.index ?? 0) + last[0].length).trim();
    const form = formOf(doseForm);
    const key = `${strength}|${form}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ strength, form, label: `${strength}${doseForm ? ` ${doseForm.toLowerCase()}` : ''}` });
  }
  const num = (s: string) => parseFloat(s) || 0;
  return out.sort((a, b) => a.form.localeCompare(b.form) || num(a.strength) - num(b.strength)).slice(0, limit);
}

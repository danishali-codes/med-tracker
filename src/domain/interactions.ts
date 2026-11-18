/**
 * Interaction notes. Two sources:
 * - a short built-in list of well-known interactions (works offline), and
 * - sentences pulled from the official US drug label (openFDA), fetched by the app.
 * Neither is complete. The app always shows a "check with your doctor or pharmacist" notice.
 */

export type InteractionKind = 'medicine' | 'alcohol' | 'food';

export interface InteractionNote {
  kind: InteractionKind;
  /** For kind 'medicine': the two medicines involved (display names). */
  between?: [string, string];
  text: string;
  /** Where the note comes from, e.g. "Common known interaction" or "US label for metronidazole". */
  source: string;
  serious?: boolean;
}

/** One medicine as the checker sees it: what to call it and the words that identify it. */
export interface CheckedMed {
  id: string;
  name: string;
  /** Lower-case ingredient names, e.g. ["amlodipine", "valsartan"]. */
  ingredients: string[];
}

const SALTS = new Set(
  'hydrochloride hcl sodium potassium calcium magnesium maleate besylate besilate mesylate succinate tartrate citrate sulfate sulphate phosphate acetate bromide fumarate dihydrate monohydrate'.split(' '),
);

export function ingredientsOf(name: string, generic?: string | null): string[] {
  const src = (generic?.trim() || name).toLowerCase();
  return [
    ...new Set(
      src
        .split(/\s*(?:\/|\+|,|\band\b|\bwith\b)\s*/)
        .map((s) => s.replace(/\b(tablets?|capsules?|\d+(\.\d+)?\s*(mg|mcg|g|ml|%))(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim())
        // Drop salt words after the first word ("metformin hydrochloride" -> "metformin"),
        // but keep a first word that is itself a mineral ("calcium carbonate", "magnesium").
        .map((s) => {
          const [first, ...rest] = s.split(' ');
          return [first, ...rest.filter((w) => !SALTS.has(w))].join(' ').trim();
        })
        .filter((s) => s.length > 2),
    ),
  ];
}

// ---- built-in list ----

interface Known {
  match: string[];
  kind: 'alcohol' | 'food';
  text: string;
  serious?: boolean;
}

const KNOWN: Known[] = [
  { match: ['metronidazole', 'tinidazole'], kind: 'alcohol', serious: true, text: 'Avoid alcohol while taking it and for at least 3 days after the last dose. Together they can cause severe nausea, vomiting, flushing and a fast heartbeat.' },
  { match: ['paracetamol', 'acetaminophen'], kind: 'alcohol', text: 'Drinking a lot of alcohol while taking it raises the risk of liver damage.' },
  { match: ['ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'etoricoxib', 'celecoxib', 'mefenamic acid', 'ketoprofen'], kind: 'alcohol', text: 'Alcohol raises the risk of stomach bleeding with this medicine.' },
  { match: ['metformin'], kind: 'alcohol', text: 'Heavy or binge drinking raises the risk of lactic acidosis, a rare but serious side effect.' },
  { match: ['alprazolam', 'clonazepam', 'diazepam', 'lorazepam', 'zolpidem', 'tramadol', 'codeine', 'morphine', 'oxycodone', 'pregabalin', 'gabapentin', 'quetiapine', 'olanzapine', 'promethazine', 'diphenhydramine'], kind: 'alcohol', serious: true, text: 'Alcohol adds to the drowsiness this medicine causes and can slow breathing. Avoid drinking.' },
  { match: ['warfarin'], kind: 'alcohol', text: 'Alcohol can change how well warfarin works and raise bleeding risk. Keep any drinking light and steady.' },
  { match: ['warfarin'], kind: 'food', text: 'Foods rich in vitamin K (spinach, kale, broccoli, green tea) affect warfarin. Keep the amount you eat steady rather than avoiding them. Cranberry juice may also raise bleeding risk.' },
  { match: ['simvastatin', 'atorvastatin', 'lovastatin'], kind: 'food', text: 'Large amounts of grapefruit or grapefruit juice raise the level of this medicine in the blood and the risk of muscle side effects.' },
  { match: ['felodipine', 'nifedipine', 'cyclosporine', 'ciclosporin', 'tacrolimus'], kind: 'food', text: 'Grapefruit and grapefruit juice can raise the level of this medicine in the blood.' },
  { match: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'doxycycline', 'tetracycline', 'minocycline'], kind: 'food', text: 'Milk, yogurt, calcium, iron, zinc and antacids stop this medicine from being absorbed. Take it a few hours apart from them.' },
  { match: ['levothyroxine', 'thyroxine'], kind: 'food', text: 'Take it on an empty stomach, usually 30 to 60 minutes before breakfast. Coffee, soy, calcium and iron supplements reduce how much is absorbed.' },
  { match: ['alendronate', 'risedronate', 'ibandronate'], kind: 'food', text: 'Take it first thing with plain water only, at least 30 minutes before food, drinks or other medicines.' },
  { match: ['phenelzine', 'tranylcypromine', 'selegiline', 'isocarbazid', 'linezolid'], kind: 'food', serious: true, text: 'Foods high in tyramine (aged cheese, cured meats, soy sauce, draft beer) can cause a dangerous rise in blood pressure.' },
  { match: ['spironolactone', 'eplerenone', 'lisinopril', 'enalapril', 'ramipril', 'perindopril', 'captopril'], kind: 'food', text: 'Potassium supplements and salt substitutes can push potassium too high with this medicine.' },
  { match: ['iron', 'ferrous'], kind: 'food', text: 'Tea, coffee, milk and calcium reduce iron absorption. Vitamin C or orange juice helps it.' },
];

interface KnownPair {
  a: string[];
  b: string[];
  text: string;
  serious?: boolean;
}

const KNOWN_PAIRS: KnownPair[] = [
  { a: ['sildenafil', 'tadalafil', 'vardenafil', 'avanafil'], b: ['nitroglycerin', 'glyceryl trinitrate', 'isosorbide'], serious: true, text: 'Taken together they can cause a sudden, dangerous drop in blood pressure.' },
  { a: ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran', 'clopidogrel'], b: ['aspirin', 'ibuprofen', 'diclofenac', 'naproxen', 'etoricoxib', 'celecoxib', 'mefenamic acid'], serious: true, text: 'Together they raise the risk of bleeding.' },
  { a: ['fluoxetine', 'sertraline', 'escitalopram', 'citalopram', 'paroxetine', 'venlafaxine', 'duloxetine'], b: ['tramadol', 'sumatriptan', 'linezolid', 'phenelzine', 'tranylcypromine', 'selegiline'], serious: true, text: 'Together they can cause serotonin syndrome (agitation, sweating, fast heartbeat, muscle twitching).' },
  { a: ['simvastatin', 'atorvastatin', 'lovastatin'], b: ['clarithromycin', 'erythromycin', 'itraconazole', 'ketoconazole'], serious: true, text: 'The second medicine raises the statin level and the risk of serious muscle damage.' },
  { a: ['alprazolam', 'clonazepam', 'diazepam', 'lorazepam', 'zolpidem'], b: ['tramadol', 'codeine', 'morphine', 'oxycodone', 'pregabalin', 'gabapentin'], serious: true, text: 'Both cause drowsiness and together can slow breathing.' },
  { a: ['spironolactone', 'eplerenone'], b: ['lisinopril', 'enalapril', 'ramipril', 'perindopril', 'losartan', 'valsartan', 'candesartan', 'irbesartan', 'telmisartan', 'olmesartan'], text: 'Together they can raise potassium levels. Your doctor may check your blood.' },
  { a: ['levothyroxine'], b: ['calcium carbonate', 'ferrous', 'iron', 'omeprazole', 'esomeprazole', 'pantoprazole'], text: 'The second medicine can reduce how much levothyroxine is absorbed. Take them a few hours apart.' },
  { a: ['ciprofloxacin', 'levofloxacin', 'doxycycline'], b: ['calcium carbonate', 'ferrous', 'iron', 'zinc', 'magnesium'], text: 'The supplement stops the antibiotic from being absorbed. Take them a few hours apart.' },
];

const hit = (ingredients: string[], words: string[]) => ingredients.some((i) => words.some((w) => i.includes(w)));

export function knownNotes(meds: CheckedMed[]): InteractionNote[] {
  const out: InteractionNote[] = [];
  for (const m of meds) {
    for (const k of KNOWN) {
      if (hit(m.ingredients, k.match)) out.push({ kind: k.kind, text: `${m.name}: ${k.text}`, source: 'Common known interaction', serious: k.serious });
    }
  }
  for (let i = 0; i < meds.length; i++) {
    for (let j = 0; j < meds.length; j++) {
      if (i === j) continue;
      for (const p of KNOWN_PAIRS) {
        if (hit(meds[i].ingredients, p.a) && hit(meds[j].ingredients, p.b)) {
          out.push({ kind: 'medicine', between: [meds[i].name, meds[j].name], text: p.text, source: 'Common known interaction', serious: p.serious });
        }
      }
    }
  }
  return out;
}

// ---- label text ----

/** Label sections we read, most important first. */
export const LABEL_FIELDS = [
  'boxed_warning',
  'contraindications',
  'drug_interactions',
  'warnings_and_cautions',
  'warnings',
  'precautions',
  'do_not_use',
  'ask_doctor_or_pharmacist',
  'when_using',
  'information_for_patients',
  'patient_counseling_information',
  'dosage_and_administration',
] as const;

export type Label = Partial<Record<(typeof LABEL_FIELDS)[number], string[]>>;

const ALCOHOL = /\b(alcohol|alcoholic|ethanol|drinks? per day)\b/i;
const FOOD = /\b(grapefruit|food|meals?|milk|dairy|antacids?|caffeine|coffee|tyramine|vitamin k|potassium supplements?|salt substitutes?|empty stomach|high-fat|st\.? john'?s wort|juice)\b/i;
const NOT_FOOD = /food and drug administration|food allerg/i;

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 450);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Pulls the sentences about alcohol, food and the user's other medicines out of
 * one medicine's label. At most `perKind` sentences of each kind.
 */
export function notesFromLabel(med: CheckedMed, label: Label, others: CheckedMed[], perKind = 3): InteractionNote[] {
  const source = `US label for ${med.ingredients.join(' / ') || med.name}`;
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  const out: InteractionNote[] = [];
  const add = (n: InteractionNote, key: string) => {
    if (seen.has(n.text) || (counts[key] ?? 0) >= perKind) return;
    seen.add(n.text);
    counts[key] = (counts[key] ?? 0) + 1;
    out.push(n);
  };
  const otherPatterns = others.map((o) => ({
    o,
    re: o.ingredients.length ? new RegExp(`\\b(${o.ingredients.map(escape).join('|')})\\b`, 'i') : null,
  }));
  for (const field of LABEL_FIELDS) {
    const serious = field === 'boxed_warning' || field === 'contraindications';
    for (const block of label[field] ?? []) {
      for (const s of sentences(block)) {
        for (const { o, re } of otherPatterns) {
          if (re?.test(s)) add({ kind: 'medicine', between: [med.name, o.name], text: s, source, serious }, `m:${o.id}`);
        }
        if (ALCOHOL.test(s)) add({ kind: 'alcohol', text: s, source, serious }, 'alcohol');
        else if (FOOD.test(s) && !NOT_FOOD.test(s) && field !== 'dosage_and_administration') add({ kind: 'food', text: s, source, serious }, 'food');
        else if (field === 'dosage_and_administration' && /\b(with|without) (food|a meal|meals)|empty stomach\b/i.test(s)) add({ kind: 'food', text: s, source }, 'food');
      }
    }
  }
  return out;
}

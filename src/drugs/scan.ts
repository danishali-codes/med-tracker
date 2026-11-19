// Reads the text on a medicine box (from the phone's on-device text recognition)
// and guesses the name, strength, form and pack size. You check it before saving.
import type { MedForm } from '../domain/types';
import { CATALOG } from './catalog';

export interface BoxGuess {
  name: string | null;
  generic: string | null;
  strength: string | null;
  form: MedForm | null;
  /** Units in the pack, e.g. 30 tablets. */
  packCount: number | null;
}

const FORM_WORDS: [RegExp, MedForm][] = [
  [/\b(film[- ]?coated |chewable |effervescent |dispersible )?(tablets?|tabs?|caplets?)\b/i, 'pill'],
  [/\b(soft ?gels?|capsules?|caps)\b/i, 'capsule'],
  [/\b(syrup|suspension|oral solution|oral liquid|elixir)\b/i, 'liquid'],
  [/\b(eye|ear|nasal)? ?drops\b/i, 'drops'],
  [/\b(inhaler|puffs?|inhalation|evohaler|turbuhaler|diskus)\b/i, 'inhaler'],
  [/\b(injection|injectable|pre-?filled pen|pen|vial|ampoules?|syringe)\b/i, 'injection'],
  [/\b(cream|ointment|gel|lotion)\b/i, 'cream'],
  [/\b(sachets?|granules|powder for oral)\b/i, 'sachet'],
  [/\b(patch|patches|transdermal)\b/i, 'patch'],
];

const STRENGTH = /(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|ug|g|ml|iu|units?|%)(?:\s?\/\s?(\d+(?:[.,]\d+)?)?\s?(ml|g|dose))?\b/i;
const PACK = /\b(\d{1,3})\s*(?:x\s*)?(?:film[- ]?coated\s+|chewable\s+|effervescent\s+|hard\s+|soft\s+)?(tablets?|tabs|capsules?|caps|sachets?|softgels?|patches)\b/i;
const NOISE = /\b(each|contains|tablet|capsule|keep|store|below|use|only|read|leaflet|manufactured|pharma|pharmaceutical|ltd|llc|inc|gmbh|batch|lot|exp|mfg|rx|prescription|oral|film|coated|for|the|and|of|by|under|licen[cs]e|reg|no\.?)\b/i;

function normStrength(m: RegExpMatchArray): string {
  const n = m[1].replace(',', '.');
  let unit = m[2].toLowerCase();
  if (unit === 'ug' || unit === 'µg') unit = 'mcg';
  if (unit === 'iu') unit = 'IU';
  if (unit === 'unit') unit = 'units';
  const per = m[4] ? ` / ${m[3] ? `${m[3].replace(',', '.')} ` : ''}${m[4].toLowerCase()}` : '';
  return `${n} ${unit}${per}`.replace(/ \/ /, '/');
}

/** Lines of text read from the box → best guesses. */
export function guessFromBox(lines: string[], extraNames: string[] = []): BoxGuess {
  const text = lines.join('\n');
  const flat = lines.join(' ');

  // Known names first: brands before generics (a box shows both), then the longest match.
  const isBrand = (k: { name: string; generic: string }) => k.name.toLowerCase() !== k.generic.toLowerCase();
  const known = [...CATALOG.map((c) => ({ name: c.name, generic: c.generic })), ...extraNames.map((n) => ({ name: n, generic: '' }))].sort(
    (a, b) => Number(isBrand(b)) - Number(isBrand(a)) || b.name.length - a.name.length,
  );
  const hit = known.find((k) => k.name.length >= 3 && new RegExp(`\\b${k.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(flat));

  let name: string | null = hit?.name ?? null;
  if (!name) {
    // Otherwise the first short line that looks like a name (letters, few words, no numbers or label text).
    const cand = lines
      .map((l) => l.trim())
      .find((l) => l.length >= 3 && l.length <= 28 && /^[A-Za-z][A-Za-z\- ]+$/.test(l) && l.split(/\s+/).length <= 3 && !NOISE.test(l));
    name = cand ? cand.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a: string, b: string) => a + b.toLowerCase()) : null;
  }

  const sm = text.match(STRENGTH);
  const form = FORM_WORDS.find(([re]) => re.test(text))?.[1] ?? null;
  const pm = text.match(PACK);
  const pack = pm ? Number(pm[1]) : null;
  return {
    name,
    generic: hit?.generic || null,
    strength: sm ? normStrength(sm) : null,
    form,
    packCount: pack && pack > 0 && pack <= 500 ? pack : null,
  };
}

/**
 * The product number from a barcode. Medicine boxes in the Gulf often carry a GS1
 * DataMatrix that also holds the batch, expiry and serial number, which differ per box;
 * only the GTIN (after "01") identifies the product. EAN/UPC codes are padded to 14 digits.
 */
export function productCode(data: string | null | undefined): string | null {
  if (!data) return null;
  const clean = data.replace(/[\u001d\s]/g, '').replace(/^\][A-Za-z]\d/, '');
  const gs1 = clean.match(/^(?:\(01\)|01)(\d{14})/);
  if (gs1) return gs1[1];
  if (/^\d{8,14}$/.test(clean)) return clean.padStart(14, '0');
  return clean || null;
}

import { Directory, File, Paths } from 'expo-file-system';
import { getSettings } from '../db/repo';
import type { Label } from '../domain/interactions';
import { LABEL_FIELDS } from '../domain/interactions';
import { CATALOG } from './catalog';
import { parseStrengths, rankNames, type NameHit, type StrengthOption } from './rank';

/**
 * Online lookups. This file is the only place in the app that goes on the internet.
 * Only a medicine or ingredient name is sent, never anything about the person:
 * - RxNav (US National Library of Medicine): the full list of drug names (~1 MB,
 *   downloaded once a month and kept on the phone, so typing in search stays on the
 *   phone), and the ingredients and strengths of a medicine once you pick it.
 * - openFDA: official US drug labels, read for interaction warnings.
 * Both are free and need no account, and nothing is sent with a cookie, token or ID.
 * With offline mode on (Settings, Privacy) nothing is sent at all, and the built-in
 * list and anything already saved on the phone are used instead.
 */

const RXNAV = 'https://rxnav.nlm.nih.gov/REST';
const OPENFDA = 'https://api.fda.gov/drug/label.json';
const MONTH = 30 * 24 * 3600 * 1000;

export class OfflineModeError extends Error {
  constructor() {
    super('Offline mode is on');
  }
}

/** True unless offline mode is on. Fails closed: if settings can't be read, stay offline. */
export function onlineAllowed(): boolean {
  try {
    return !getSettings().offline;
  } catch {
    return false;
  }
}

/** Every request goes through here, so offline mode can't be skipped by accident. */
async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  if (!onlineAllowed()) throw new OfflineModeError();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
      // No cookies, and no cached copy shared with anything else.
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function cacheFile(name: string) {
  return new File(Paths.cache, name);
}

async function readCache<T>(name: string, maxAgeMs: number): Promise<T | null> {
  try {
    const f = cacheFile(name);
    if (!f.exists) return null;
    const parsed = JSON.parse(await f.text()) as { at: number; data: T };
    return Date.now() - parsed.at < maxAgeMs ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Bumped by clearDownloads, so a download that was already running can't save itself afterwards. */
let generation = 0;

function writeCache(name: string, data: unknown, gen: number) {
  if (gen !== generation || !onlineAllowed()) return;
  try {
    const f = cacheFile(name);
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify({ at: Date.now(), data }));
  } catch {
    // cache is best-effort
  }
}

/** Deletes the drug names and labels downloaded earlier. Your own data isn't touched. */
export function clearDownloads(): number {
  generation++;
  names = null;
  loading = null;
  let n = 0;
  try {
    for (const item of new Directory(Paths.cache).list()) {
      if (item instanceof File && (item.name === 'rxnorm-names.json' || /^label-.*\.json$/.test(item.name))) {
        item.delete();
        n++;
      }
    }
  } catch {
    // nothing cached yet
  }
  return n;
}

// ---- names ----

let names: string[] | null = null;
let loading: Promise<string[]> | null = null;

/** The RxNorm display-name list, from the phone's cache or downloaded. Empty when offline. */
export function loadNames(): Promise<string[]> {
  if (names) return Promise.resolve(names);
  const gen = generation;
  loading ??= (async () => {
    const cached = await readCache<string[]>('rxnorm-names.json', MONTH);
    if (cached?.length) return (names = cached);
    try {
      const res = await getJson<{ displayTermsList?: { term?: string[] } }>(`${RXNAV}/displaynames.json`, 30000);
      const list = res.displayTermsList?.term ?? [];
      if (gen !== generation) return [];
      if (list.length) writeCache('rxnorm-names.json', list, gen);
      return (names = list);
    } catch {
      loading = null; // try again next time
      return [];
    }
  })();
  return loading;
}

export async function searchMedicines(query: string): Promise<NameHit[]> {
  return rankNames(query, CATALOG, await loadNames());
}

export interface MedicineDetails {
  generic: string | null;
  rxcui: string | null;
  strengths: StrengthOption[];
}

interface Related {
  relatedGroup?: { conceptGroup?: { tty: string; conceptProperties?: { rxcui: string; name: string }[] }[] };
}

/** Ingredient(s) and available strengths for a name. Falls back to the built-in list offline. */
export async function medicineDetails(name: string, knownGeneric?: string | null): Promise<MedicineDetails> {
  const builtin = CATALOG.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  const fallback: MedicineDetails = { generic: knownGeneric ?? builtin?.generic ?? null, rxcui: null, strengths: [] };
  try {
    // A built-in brand may not exist in RxNorm, so look up its ingredient instead.
    const lookup = builtin && builtin.name.toLowerCase() !== builtin.generic ? builtin.generic.split(' / ')[0] : name.trim();
    const ids = await getJson<{ idGroup?: { rxnormId?: string[] } }>(`${RXNAV}/rxcui.json?name=${encodeURIComponent(lookup)}&search=2`);
    const rxcui = ids.idGroup?.rxnormId?.[0];
    if (!rxcui) return fallback;
    const rel = await getJson<Related>(`${RXNAV}/rxcui/${rxcui}/related.json?tty=IN+MIN+SCD+SBD`);
    const groups = rel.relatedGroup?.conceptGroup ?? [];
    const of = (tty: string) => groups.find((g) => g.tty === tty)?.conceptProperties ?? [];
    const ingredients = of('MIN')[0]?.name ?? of('IN').map((c) => c.name).join(' / ');
    const isBrand = !builtin && ingredients && !ingredients.toLowerCase().includes(name.trim().toLowerCase());
    const products = isBrand ? [...of('SBD'), ...of('SCD')] : [...of('SCD'), ...of('SBD')];
    return {
      generic: fallback.generic ?? (ingredients || null),
      rxcui,
      strengths: parseStrengths(products.map((p) => p.name)),
    };
  } catch {
    return fallback;
  }
}

// ---- labels ----

type FdaResult = Label & { openfda?: { generic_name?: string[] } };

/** The most useful US label for one ingredient, or null if none is found or the phone is offline. */
export async function fetchLabel(ingredient: string): Promise<Label | null> {
  const gen = generation;
  const key = `label-${ingredient.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  const cached = await readCache<Label | 'none'>(key, MONTH);
  if (cached) return cached === 'none' ? null : cached;
  try {
    const q = encodeURIComponent(`openfda.generic_name:"${ingredient}"`);
    const res = await getJson<{ results?: FdaResult[] }>(`${OPENFDA}?search=${q}&limit=5`);
    const results = res.results ?? [];
    // Prefer prescription-style labels that have an interactions section, then the longest.
    const size = (r: FdaResult) => (r.drug_interactions ? 1e6 : 0) + LABEL_FIELDS.reduce((n, f) => n + (r[f]?.join('').length ?? 0), 0);
    const best = results.sort((a, b) => size(b) - size(a))[0];
    const label: Label | null = best ? Object.fromEntries(LABEL_FIELDS.filter((f) => best[f]).map((f) => [f, best[f]])) : null;
    writeCache(key, label ?? 'none', gen);
    return label;
  } catch (e) {
    // 404 means openFDA has no label for it; anything else is a network problem worth retrying later.
    if (String(e).includes('HTTP 404')) writeCache(key, 'none', gen);
    return null;
  }
}

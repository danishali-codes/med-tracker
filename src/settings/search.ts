import type { Settings } from '../domain/types';
import type { SettingItem, SettingsGroup } from './types';

export interface Platformish {
  android: boolean;
}

/** Lowercase, no accents, punctuation turned into spaces. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Items that belong on this phone and in this mode. */
export function itemShown(item: SettingItem, s: Settings, opts: Platformish & { advanced: boolean }): boolean {
  if (item.androidOnly && !opts.android) return false;
  if (item.advanced && !opts.advanced) return false;
  if (item.visible && !item.visible(s)) return false;
  return true;
}

export function groupShown(g: SettingsGroup, opts: Platformish): boolean {
  return !g.androidOnly || opts.android;
}

/**
 * How well an item matches. Every word typed has to appear somewhere (title, keywords, hint,
 * or the group and section names); matches in the title count most. 0 means no match.
 */
export function scoreItem(item: SettingItem, query: string, context: string[] = []): number {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return 0;
  const title = normalize(item.title);
  const keys = normalize((item.keywords ?? []).join(' '));
  const hint = normalize(item.hint ?? '');
  const ctx = normalize(context.join(' '));
  const titleWords = title.split(' ');
  let score = 0;
  for (const w of words) {
    if (titleWords.some((t) => t.startsWith(w))) score += 10;
    else if (title.includes(w)) score += 6;
    else if (keys.split(' ').some((k) => k.startsWith(w))) score += 5;
    else if (hint.split(' ').some((h) => h.startsWith(w))) score += 2;
    else if (keys.includes(w) || hint.includes(w)) score += 1;
    else if (ctx.split(' ').some((c) => c.startsWith(w))) score += 1;
    else return 0;
  }
  if (title.startsWith(normalize(query))) score += 8;
  return score;
}

export interface SearchHit {
  group: SettingsGroup;
  items: SettingItem[];
}

/**
 * Finds settings across every group, advanced ones included. Results come grouped, best group
 * first and best item first within it.
 */
export function searchSettings(groups: SettingsGroup[], query: string, s: Settings, opts: Platformish): SearchHit[] {
  const hits: { group: SettingsGroup; items: { item: SettingItem; score: number }[]; best: number }[] = [];
  for (const group of groups) {
    if (!groupShown(group, opts)) continue;
    const found: { item: SettingItem; score: number }[] = [];
    for (const section of group.sections) {
      for (const item of section.items) {
        if (!itemShown(item, s, { ...opts, advanced: true })) continue;
        const score = scoreItem(item, query, [group.title, section.title ?? '']);
        if (score > 0) found.push({ item, score });
      }
    }
    if (found.length) {
      found.sort((a, b) => b.score - a.score);
      hits.push({ group, items: found, best: found[0].score });
    }
  }
  hits.sort((a, b) => b.best - a.best);
  return hits.map((h) => ({ group: h.group, items: h.items.map((i) => i.item) }));
}

/** How many advanced settings Simple mode is hiding in a group right now. */
export function hiddenAdvancedCount(group: SettingsGroup, s: Settings, opts: Platformish): number {
  let n = 0;
  for (const section of group.sections) {
    for (const item of section.items) {
      if (item.advanced && itemShown(item, s, { ...opts, advanced: true })) n++;
    }
  }
  return n;
}

/** Checks the registry: ids must be unique, since they are React keys and search results. */
export function duplicateIds(groups: SettingsGroup[]): string[] {
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const g of groups) {
    if (seen.has(`group:${g.id}`)) dup.push(g.id);
    seen.add(`group:${g.id}`);
    for (const sec of g.sections)
      for (const i of sec.items) {
        if (seen.has(i.id)) dup.push(i.id);
        seen.add(i.id);
      }
  }
  return dup;
}

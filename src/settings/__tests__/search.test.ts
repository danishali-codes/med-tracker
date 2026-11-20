import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../domain/types';
import { duplicateIds, hiddenAdvancedCount, itemShown, scoreItem, searchSettings } from '../search';
import type { SettingItem, SettingsGroup } from '../types';

const C = () => null;
const item = (o: Partial<SettingItem> & { id: string; title: string }): SettingItem => ({ Component: C, ...o });

const GROUPS: SettingsGroup[] = [
  {
    id: 'look',
    title: 'Look and feel',
    icon: 'color-palette-outline',
    blurb: '',
    sections: [{ items: [item({ id: 'appearance', title: 'Appearance', keywords: ['dark mode', 'theme'] }), item({ id: 'trueBlack', title: 'True black in dark mode' })] }],
  },
  {
    id: 'reminders',
    title: 'Reminders',
    icon: 'notifications-outline',
    blurb: '',
    sections: [
      {
        title: 'How reminders behave',
        items: [
          item({ id: 'nag', title: 'Keep reminding until I answer', keywords: ['repeat'] }),
          item({ id: 'nagEvery', title: 'Repeat every', advanced: true, visible: (s) => s.nagEnabled }),
          item({ id: 'snooze', title: 'Snooze for', advanced: true, hint: 'How long Snooze waits.' }),
          item({ id: 'alarm', title: 'Alarm-style reminders', androidOnly: true, advanced: true }),
        ],
      },
    ],
  },
  { id: 'devices', title: 'Watch and widgets', icon: 'watch-outline', blurb: '', androidOnly: true, sections: [{ items: [item({ id: 'tile', title: 'Watch tile', androidOnly: true })] }] },
];

const ids = (hits: ReturnType<typeof searchSettings>) => hits.flatMap((h) => h.items.map((i) => i.id));
const android = { android: true };

describe('settings search', () => {
  it('finds by title, keyword and hint, ignoring case and punctuation', () => {
    expect(ids(searchSettings(GROUPS, 'APPEAR', DEFAULT_SETTINGS, android))).toEqual(['appearance']);
    expect(ids(searchSettings(GROUPS, 'theme', DEFAULT_SETTINGS, android))).toEqual(['appearance']);
    expect(ids(searchSettings(GROUPS, 'alarm style', DEFAULT_SETTINGS, android))).toEqual(['alarm']);
    expect(ids(searchSettings(GROUPS, 'waits', DEFAULT_SETTINGS, android))).toEqual(['snooze']);
  });

  it('ranks title matches above keyword matches', () => {
    expect(ids(searchSettings(GROUPS, 'dark', DEFAULT_SETTINGS, android))).toEqual(['trueBlack', 'appearance']);
  });

  it('needs every word to match', () => {
    expect(ids(searchSettings(GROUPS, 'snooze dark', DEFAULT_SETTINGS, android))).toEqual([]);
    expect(scoreItem(GROUPS[0].sections[0].items[1], '   ')).toBe(0);
  });

  it('finds advanced settings even in Simple mode, but respects visibility and platform', () => {
    expect(DEFAULT_SETTINGS.showAdvanced).toBe(false);
    expect(ids(searchSettings(GROUPS, 'snooze', DEFAULT_SETTINGS, android))).toEqual(['snooze']);
    expect(ids(searchSettings(GROUPS, 'repeat', { ...DEFAULT_SETTINGS, nagEnabled: false }, android))).toEqual(['nag']);
    expect(ids(searchSettings(GROUPS, 'repeat', { ...DEFAULT_SETTINGS, nagEnabled: true }, android))).toEqual(['nagEvery', 'nag']);
    expect(ids(searchSettings(GROUPS, 'watch', DEFAULT_SETTINGS, { android: false }))).toEqual([]);
  });

  it('matches group and section names as a last resort', () => {
    expect(ids(searchSettings(GROUPS, 'behave', DEFAULT_SETTINGS, android))).toContain('snooze');
  });

  it('hides advanced items in Simple mode and counts them', () => {
    const snooze = GROUPS[1].sections[0].items[2];
    expect(itemShown(snooze, DEFAULT_SETTINGS, { android: true, advanced: false })).toBe(false);
    expect(itemShown(snooze, DEFAULT_SETTINGS, { android: true, advanced: true })).toBe(true);
    expect(hiddenAdvancedCount(GROUPS[1], { ...DEFAULT_SETTINGS, nagEnabled: true }, android)).toBe(3);
    expect(hiddenAdvancedCount(GROUPS[1], { ...DEFAULT_SETTINGS, nagEnabled: false }, { android: false })).toBe(1);
  });

  it('spots duplicate ids', () => {
    expect(duplicateIds(GROUPS)).toEqual([]);
    expect(duplicateIds([...GROUPS, { ...GROUPS[0], id: 'other' }])).toEqual(['appearance', 'trueBlack']);
  });
});

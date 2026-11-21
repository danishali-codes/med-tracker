import { describe, expect, it } from 'vitest';
import { layoutFor, listRows, renderLayout, LIST_WIDGET_NAME, NEXT_WIDGET_NAME, WIDGET_NAME } from '../layout';
import { moodColors, moodOf } from '../theme';
import { confettiSvg, pillSvg, ringsSvg } from '../svg';
import { MEDS, SCENARIOS } from './fixtures';

// @ts-expect-error the library ships no types for this internal file
const { buildWidgetTree } = await import('../../../node_modules/react-native-android-widget/lib/module/api/build-widget-tree.js');

type Node = { type: string; props: Record<string, unknown>; children?: Node[] };
const walk = (n: Node, out: Node[] = []) => {
  out.push(n);
  (n.children ?? []).forEach((c) => walk(c, out));
  return out;
};
const texts = (tree: Node) => walk(tree).filter((n) => n.type === 'TextWidget').map((n) => n.props.text as string);
const actions = (tree: Node) => walk(tree).map((n) => n.props.clickAction).filter(Boolean);

const SIZES: [string, number, number][] = [
  [NEXT_WIDGET_NAME, 160, 160],
  [NEXT_WIDGET_NAME, 120, 120],
  [NEXT_WIDGET_NAME, 300, 70],
  [NEXT_WIDGET_NAME, 180, 70],
  [NEXT_WIDGET_NAME, 330, 175],
  [NEXT_WIDGET_NAME, 160, 330],
  [WIDGET_NAME, 320, 150],
  [WIDGET_NAME, 260, 110],
  [WIDGET_NAME, 0, 0],
  [LIST_WIDGET_NAME, 320, 320],
  [LIST_WIDGET_NAME, 320, 200],
  [LIST_WIDGET_NAME, 320, 140],
];

describe('home screen widgets', () => {
  it('build a widget tree in every state, size and theme', () => {
    for (const [state, data] of Object.entries(SCENARIOS)) {
      for (const dark of [false, true]) {
        for (const [name, w, h] of SIZES) {
          const tree = buildWidgetTree(renderLayout(name, data, dark, w, h));
          expect(['LinearLayoutWidget', 'FrameLayoutWidget'], `${state} ${name} ${w}x${h}`).toContain(tree.type);
        }
      }
    }
  });

  it('pick a smaller layout when resized small', () => {
    expect(layoutFor(WIDGET_NAME, 320, 150)).toBe('today');
    expect(layoutFor(WIDGET_NAME, 150, 150)).toBe('next');
    expect(layoutFor(WIDGET_NAME, 320, 70)).toBe('next');
    expect(layoutFor(LIST_WIDGET_NAME, 320, 300)).toBe('list');
    expect(layoutFor(LIST_WIDGET_NAME, 320, 150)).toBe('today');
    expect(layoutFor(LIST_WIDGET_NAME, 0, 0)).toBe('list');
    expect(layoutFor(NEXT_WIDGET_NAME, 0, 0)).toBe('next');
    expect(layoutFor(WIDGET_NAME, 0, 0)).toBe('today');
    // Any widget made bigger shows more: the list of every dose once it's tall enough.
    expect(layoutFor(NEXT_WIDGET_NAME, 400, 400)).toBe('list');
    expect(layoutFor(WIDGET_NAME, 330, 250)).toBe('list');
    expect(layoutFor(NEXT_WIDGET_NAME, 160, 330)).toBe('next');
    // Next dose stretched wide shows the big rings beside the dose instead of an empty box.
    expect(layoutFor(NEXT_WIDGET_NAME, 330, 175)).toBe('today');
    expect(layoutFor(NEXT_WIDGET_NAME, 330, 80)).toBe('next');
    expect(listRows(320, { showNames: false })).toBeGreaterThan(listRows(320, { showNames: true }));
  });

  it('hide medicine names unless the person turned them on', () => {
    const names = MEDS.map((m) => m.name);
    for (const [name, w, h] of SIZES) {
      const hidden = texts(buildWidgetTree(renderLayout(name, SCENARIOS.due, false, w, h))).join(' ');
      for (const n of names) expect(hidden).not.toContain(n);
    }
    expect(SCENARIOS.due.next?.names).toBe('2 medicines');
    expect(SCENARIOS.due.rows[0].title).toBe('500 mg · 1 tablet');
    expect(SCENARIOS.dueNames.next?.names).toBe('Metformin +1');
    const shown = texts(buildWidgetTree(renderLayout(LIST_WIDGET_NAME, SCENARIOS.dueNames, false, 320, 320))).join(' ');
    expect(shown).toContain('Metformin');
  });

  it('offer Taken and Snooze only when a dose is due, and no Snooze while snoozed', () => {
    const due = actions(buildWidgetTree(renderLayout(WIDGET_NAME, SCENARIOS.due, false, 320, 150)));
    expect(due).toContain('TAKE_NEXT');
    expect(due).toContain('SNOOZE_NEXT');
    const snoozed = buildWidgetTree(renderLayout(WIDGET_NAME, SCENARIOS.snoozed, false, 320, 150));
    expect(actions(snoozed)).toContain('TAKE_NEXT');
    expect(actions(snoozed)).not.toContain('SNOOZE_NEXT');
    expect(texts(snoozed).join(' ')).toMatch(/SNOOZED TILL 8:28 AM/);
    const later = actions(buildWidgetTree(renderLayout(WIDGET_NAME, SCENARIOS.later, false, 320, 150)));
    expect(later).not.toContain('TAKE_NEXT');
    expect(later).not.toContain('SNOOZE_NEXT');
  });

  it('turn green when the day is done and gold when it was all on time', () => {
    expect(moodOf(SCENARIOS.due)).toBe('day');
    expect(moodOf(SCENARIOS.done)).toBe('done');
    expect(moodOf(SCENARIOS.gold)).toBe('gold');
    expect(moodOf(SCENARIOS.empty)).toBe('day');
    const bg = (state: keyof typeof SCENARIOS) =>
      (buildWidgetTree(renderLayout(WIDGET_NAME, SCENARIOS[state], false, 320, 150)) as Node).props.backgroundColor;
    expect(new Set([bg('due'), bg('done'), bg('gold')]).size).toBe(3);
    expect(moodColors(false, 'done').bg).not.toBe(moodColors(false, 'day').bg);
  });

  it('list only the doses still to take, next one first', () => {
    expect(SCENARIOS.due.rows.map((r) => r.time)).toEqual(['08:00', '08:00', '21:00', '21:00']);
    const later = SCENARIOS.later;
    expect(later.rows.every((r) => r.status === 'open')).toBe(true);
    expect(later.rows.map((r) => r.time)).toEqual(['21:00', '21:00']);
    expect(later.next?.time).toBe('21:00');
    // The rings still count what was taken.
    expect([later.done, later.total]).toEqual([2, 4]);
    expect(SCENARIOS.gold.rows).toEqual([]);
    const list = texts(buildWidgetTree(renderLayout(LIST_WIDGET_NAME, SCENARIOS.gold, false, 320, 320))).join(' ');
    expect(list).toContain('Nothing left to take today');
    expect(list).not.toContain('Taken');
  });

  it('count the rings from today and this week', () => {
    const d = SCENARIOS.partlyDone;
    expect([d.done, d.total, d.taken, d.onTime]).toEqual([1, 4, 1, 1]);
    expect(d.streak).toBe(6);
    expect(d.week).toBeGreaterThan(0);
  });

  it('draws SVG the phone can read', () => {
    const svgs = [
      ringsSvg({ rings: [{ pct: 1, color: '#FFFFFF' }, { pct: 0.5, color: '#B8F5D9' }, { pct: 0, color: '#FFD98A' }], size: 96, stroke: 10, gap: 3, track: '#FFFFFF', trackOpacity: 0.2 }),
      confettiSvg(320, 150, '2026-11-19', '#FFFFFF'),
      ...['round', 'oval', 'oblong', 'capsule', 'square', 'diamond', 'triangle'].map((shape) => pillSvg({ form: 'pill', shape: shape as never, color: '#FFFFFF', color2: null }, 22)),
      ...['liquid', 'injection', 'drops', 'inhaler', 'spray', 'patch', 'cream', 'sachet'].map((form) => pillSvg({ form: form as never, shape: 'round', color: '#3E7BE0', color2: null }, 22)),
    ];
    for (const s of svgs) {
      expect(s.startsWith('<svg ')).toBe(true);
      expect(s).not.toMatch(/rgba|NaN|undefined/);
    }
    // The same day always gets the same pattern.
    expect(confettiSvg(320, 150, '2026-11-19', '#FFFFFF')).toBe(confettiSvg(320, 150, '2026-11-19', '#FFFFFF'));
    expect(confettiSvg(320, 150, '2026-11-20', '#FFFFFF')).not.toBe(confettiSvg(320, 150, '2026-11-19', '#FFFFFF'));
  });
});

import { describe, expect, it } from 'vitest';

describe('home screen widget', () => {
  it('builds a widget tree in every state', async () => {
    // @ts-expect-error the library ships no types for this internal file
    const { buildWidgetTree } = await import('../../../node_modules/react-native-android-widget/lib/module/api/build-widget-tree.js');
    const { TodayWidget } = await import('../TodayWidget');
    const { ListWidget } = await import('../ListWidget');
    const rows = [
      { slot: 'a|2026-11-19|08:00', time: '08:00', label: '8:00 AM', name: 'Metformin', dose: '500 mg', status: 'taken' as const, due: true },
      { slot: 'b|2026-11-19|08:00', time: '08:00', label: '8:00 AM', name: 'Omeprazole', dose: '20 mg', status: 'open' as const, due: true },
      { slot: 'c|2026-11-19|21:00', time: '21:00', label: '9:00 PM', name: 'Atorvastatin', dose: '20 mg', status: 'open' as const, due: false },
    ];
    const base = { done: 1, total: 3, streak: 4, rows };
    const states = [
      { ...base, next: { time: '08:00', label: '8:00 AM', names: 'Metformin +1', due: true, doses: [] } },
      { ...base, next: { time: '20:00', label: '8:00 PM', names: 'Metformin', due: false, doses: [] } },
      { ...base, done: 3, next: null },
      { done: 0, total: 0, streak: 0, next: null, rows: [] },
    ];
    for (const data of states) {
      for (const dark of [false, true]) {
        const tree = buildWidgetTree(<TodayWidget data={data} dark={dark} />);
        expect(tree.type).toBe('LinearLayoutWidget');
        for (const maxRows of [2, 6]) {
          const list = buildWidgetTree(<ListWidget data={data} dark={dark} maxRows={maxRows} />);
          expect(list.type).toBe('LinearLayoutWidget');
        }
      }
    }
  });
});

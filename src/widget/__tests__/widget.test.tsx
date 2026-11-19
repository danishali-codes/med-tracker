import { describe, expect, it } from 'vitest';

describe('home screen widget', () => {
  it('builds a widget tree in every state', async () => {
    // @ts-expect-error the library ships no types for this internal file
    const { buildWidgetTree } = await import('../../../node_modules/react-native-android-widget/lib/module/api/build-widget-tree.js');
    const { TodayWidget } = await import('../TodayWidget');
    const base = { done: 1, total: 3, streak: 4 };
    const states = [
      { ...base, next: { time: '08:00', label: '8:00 AM', names: 'Metformin +1', due: true, doses: [] } },
      { ...base, next: { time: '20:00', label: '8:00 PM', names: 'Metformin', due: false, doses: [] } },
      { ...base, done: 3, next: null },
      { done: 0, total: 0, streak: 0, next: null },
    ];
    for (const data of states) {
      for (const dark of [false, true]) {
        const tree = buildWidgetTree(<TodayWidget data={data} dark={dark} />);
        expect(tree.type).toBe('LinearLayoutWidget');
      }
    }
  });
});

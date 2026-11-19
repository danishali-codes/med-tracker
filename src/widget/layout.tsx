'use no memo';
import { ListWidget } from './ListWidget';
import type { WidgetData } from './model';
import { NextWidget } from './NextWidget';
import { TodayWidget } from './TodayWidget';

/** Widget names, as in app.json. The first two keep their old names so placed widgets carry on. */
export const WIDGET_NAME = 'Today';
export const LIST_WIDGET_NAME = 'TodayList';
export const NEXT_WIDGET_NAME = 'NextDose';
export const ALL_WIDGETS = [NEXT_WIDGET_NAME, WIDGET_NAME, LIST_WIDGET_NAME];

export type Layout = 'next' | 'today' | 'list';

/**
 * Which layout fits. Each widget has its own, but a widget resized smaller than its
 * layout needs falls back to a smaller one, so any of them can be shrunk to just the
 * next dose.
 */
export function layoutFor(name: string, width = 0, height = 0): Layout {
  // Some launchers report 0 before the first resize; use the widget's own layout then.
  const known = width > 0 && height > 0;
  if (name === NEXT_WIDGET_NAME) return 'next';
  if (known && (width < 220 || height < 100)) return 'next';
  if (name === LIST_WIDGET_NAME && (!known || height >= 190)) return 'list';
  return 'today';
}

/** Rows that fit in the big widget under its header. */
export function listRows(height: number, data: Pick<WidgetData, 'showNames'>) {
  const row = data.showNames ? 40 : 30;
  return Math.max(1, Math.floor((height - 104 - 16 - 8) / row));
}

const DEFAULT_SIZE: Record<Layout, [number, number]> = { next: [160, 160], today: [320, 150], list: [320, 300] };

/** One widget, drawn for its name and size (in dp). */
export function renderLayout(name: string, data: WidgetData, dark: boolean, width?: number, height?: number) {
  const layout = layoutFor(name, width, height);
  const w = width && width > 0 ? width : DEFAULT_SIZE[layout][0];
  const h = height && height > 0 ? height : DEFAULT_SIZE[layout][1];
  if (layout === 'list') return <ListWidget data={data} dark={dark} width={w} maxRows={listRows(h, data)} />;
  if (layout === 'next') return <NextWidget data={data} dark={dark} width={w} height={h} />;
  return <TodayWidget data={data} dark={dark} width={w} height={h} />;
}

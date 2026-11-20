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
 * Which layout fits the widget's size. Every widget grows into more detail as it's resized:
 * a strip, then the next dose, then the rings beside the next dose, then the rings with
 * every dose today and its time. The name only decides the layout before the launcher
 * reports a size.
 */
export function layoutFor(name: string, width = 0, height = 0): Layout {
  // Some launchers report 0 before the first resize; use the widget's own layout then.
  if (!(width > 0 && height > 0)) return name === NEXT_WIDGET_NAME ? 'next' : name === LIST_WIDGET_NAME ? 'list' : 'today';
  if (width < 220 || height < 100) return 'next';
  if (height >= 190) return 'list';
  return 'today';
}

/** Rows that fit in the big widget under its header. */
export function listRows(height: number, data: Pick<WidgetData, 'showNames'> & { rows?: unknown[] }) {
  const fit = (room: number) => Math.max(1, Math.floor(room / listRowHeight(data)));
  const all = fit(height - LIST_HEADER - 16 - 8);
  // When some rows don't fit, leave room for the "+N more" line under them.
  return data.rows && data.rows.length > all ? fit(height - LIST_HEADER - 16 - 8 - 18) : all;
}

const LIST_HEADER = 104;
const listRowHeight = (data: Pick<WidgetData, 'showNames'>) => (data.showNames ? 40 : 30);

/** Height of the week strip the tallest list widget shows under the doses. */
export const LIST_WEEK = 62;

/**
 * How the list widget uses its height: as many doses as fit, then this week's days when
 * there's room, and any space left makes the header (and its rings) bigger.
 */
export function listSpace(height: number, data: Pick<WidgetData, 'showNames' | 'rows'>) {
  const rows = listRows(height, data);
  const shown = Math.max(1, Math.min(data.rows.length, rows));
  let spare = height - LIST_HEADER - 16 - 8 - shown * listRowHeight(data) - (data.rows.length > rows ? 18 : 0);
  const week = spare >= LIST_WEEK + 4;
  if (week) spare -= LIST_WEEK;
  return { rows, week, header: LIST_HEADER + Math.max(0, Math.min(72, Math.floor(spare * 0.7))) };
}

const DEFAULT_SIZE: Record<Layout, [number, number]> = { next: [160, 160], today: [320, 150], list: [320, 300] };

/** One widget, drawn for its name and size (in dp). */
export function renderLayout(name: string, data: WidgetData, dark: boolean, width?: number, height?: number) {
  const layout = layoutFor(name, width, height);
  const w = width && width > 0 ? width : DEFAULT_SIZE[layout][0];
  const h = height && height > 0 ? height : DEFAULT_SIZE[layout][1];
  if (layout === 'list') {
    const space = listSpace(h, data);
    return <ListWidget data={data} dark={dark} width={w} maxRows={space.rows} header={space.header} week={space.week} />;
  }
  if (layout === 'next') return <NextWidget data={data} dark={dark} width={w} height={h} />;
  return <TodayWidget data={data} dark={dark} width={w} height={h} />;
}

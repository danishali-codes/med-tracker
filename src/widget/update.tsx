import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import * as repo from '../db/repo';
import { widgetData } from './data';
import { ListWidget } from './ListWidget';
import { TodayWidget } from './TodayWidget';

export const WIDGET_NAME = 'Today';
export const LIST_WIDGET_NAME = 'TodayList';

export function renderToday() {
  const data = widgetData();
  return { light: <TodayWidget data={data} dark={false} />, dark: <TodayWidget data={data} dark /> };
}

/** The list widget shows as many rows as fit its height (about 30dp a row). */
export function renderList(heightDp = 220) {
  const data = widgetData();
  const maxRows = Math.max(2, Math.floor((heightDp - 60) / 30));
  return { light: <ListWidget data={data} dark={false} maxRows={maxRows} />, dark: <ListWidget data={data} dark maxRows={maxRows} /> };
}

export function renderWidgetNamed(name: string, heightDp?: number) {
  return name === LIST_WIDGET_NAME ? renderList(heightDp) : renderToday();
}

/** Redraws widgets right away; use in background tasks that may end soon after. */
export async function refreshWidgetNow() {
  if (Platform.OS !== 'android') return;
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => renderToday() }).catch(() => {});
  await requestWidgetUpdate({ widgetName: LIST_WIDGET_NAME, renderWidget: (info) => renderList(info.height) }).catch(() => {});
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Redraws any Today widgets on the home screen. Cheap to call often; calls are merged. */
export function refreshWidget() {
  if (Platform.OS !== 'android') return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    refreshWidgetNow();
  }, 300);
}

// Any change to doses or meds redraws the widget.
repo.subscribe(refreshWidget);

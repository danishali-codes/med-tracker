import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import * as repo from '../db/repo';
import { widgetData } from './data';
import { TodayWidget } from './TodayWidget';

export const WIDGET_NAME = 'Today';

export function renderToday() {
  const data = widgetData();
  return { light: <TodayWidget data={data} dark={false} />, dark: <TodayWidget data={data} dark /> };
}

/** Redraws widgets right away; use in background tasks that may end soon after. */
export async function refreshWidgetNow() {
  if (Platform.OS !== 'android') return;
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => renderToday() }).catch(() => {});
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

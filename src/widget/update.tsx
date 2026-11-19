import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import * as repo from '../db/repo';
import { widgetData } from './data';
import { ALL_WIDGETS, renderLayout } from './layout';

/** The light and dark versions of a widget at its current size (in dp). */
export function renderWidgetNamed(name: string, width?: number, height?: number) {
  const data = widgetData();
  return { light: renderLayout(name, data, false, width, height), dark: renderLayout(name, data, true, width, height) };
}

/** Redraws widgets right away; use in background tasks that may end soon after. */
export async function refreshWidgetNow() {
  if (Platform.OS !== 'android') return;
  for (const name of ALL_WIDGETS) {
    await requestWidgetUpdate({ widgetName: name, renderWidget: (info) => renderWidgetNamed(name, info.width, info.height) }).catch(() => {});
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Redraws any Sabr widgets on the home screen. Cheap to call often; calls are merged. */
export function refreshWidget() {
  if (Platform.OS !== 'android') return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    refreshWidgetNow();
  }, 300);
}

// Any change to doses, meds or settings redraws the widgets.
repo.subscribe(refreshWidget);

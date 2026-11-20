import { pushShare } from './sync/engine';
import { pushToWatchNow } from './wear/sync';
import { refreshWidgetNow } from './widget/update';

/**
 * Brings every place that shows today's doses up to date: home screen widgets, the watch
 * tile and (when sharing is on) what caregivers see. Background work calls this before it
 * ends, because the app's own listeners may not be running then. Each part does nothing
 * when it's switched off.
 */
export async function refreshSurfaces() {
  await refreshWidgetNow().catch(() => {});
  await pushToWatchNow().catch(() => {});
  await pushShare().catch(() => {});
}

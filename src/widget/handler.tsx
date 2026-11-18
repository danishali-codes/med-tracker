import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { logDose } from '../actions';
import { renderToday } from './update';
import { widgetData } from './data';

/** Runs in the background when a widget is added, refreshed or tapped. */
export async function widgetTaskHandler({ widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TAKE_NEXT') {
    const next = widgetData().next;
    // Only take the group the widget showed, in case the day moved on since.
    if (next && next.due && next.time === clickActionData?.time) {
      for (const d of next.doses) await logDose(d, 'taken').catch(() => {});
    }
  }
  renderWidget(renderToday());
}

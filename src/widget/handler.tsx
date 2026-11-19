import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { logDose } from '../actions';
import { dosesOn } from '../domain/schedule';
import * as repo from '../db/repo';
import { renderWidgetNamed } from './update';
import { widgetData } from './data';

/** Runs in the background when a widget is added, refreshed or tapped. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TAKE_NEXT') {
    const next = widgetData().next;
    // Only take the group the widget showed, in case the day moved on since.
    if (next && next.due && next.time === clickActionData?.time) {
      for (const d of next.doses) await logDose(d, 'taken').catch(() => {});
    }
  }
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TAKE_SLOT' && typeof clickActionData?.slot === 'string') {
    const row = widgetData().rows.find((r) => r.slot === clickActionData.slot);
    const dose = row && row.status === 'open' && row.due ? dosesOn(repo.getMeds(), row.slot.split('|')[1]).find((d) => d.slot === row.slot) : null;
    if (dose) await logDose(dose, 'taken').catch(() => {});
  }
  renderWidget(renderWidgetNamed(widgetInfo.widgetName, widgetInfo.height));
}

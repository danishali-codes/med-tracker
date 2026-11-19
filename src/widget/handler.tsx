import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { logDose, snoozeDoses } from '../actions';
import { dosesOn } from '../domain/schedule';
import * as repo from '../db/repo';
import { renderWidgetNamed } from './update';
import { widgetData } from './data';

/** Runs in the background when a widget is added, resized, refreshed or tapped. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK') await handleClick(clickAction, clickActionData);
  renderWidget(renderWidgetNamed(widgetInfo.widgetName, widgetInfo.width, widgetInfo.height));
}

async function handleClick(clickAction: string | undefined, clickActionData: Record<string, unknown> | undefined) {
  if (clickAction === 'TAKE_NEXT' || clickAction === 'SNOOZE_NEXT') {
    const data = widgetData();
    const next = data.next;
    // Only act on the time the widget showed, in case the day moved on since.
    if (!next || !next.due || next.time !== clickActionData?.time) return;
    if (clickAction === 'TAKE_NEXT') {
      for (const d of next.doses) await logDose(d, 'taken').catch(() => {});
    } else {
      await snoozeDoses(data.date, next.time, data.snoozeMinutes).catch(() => {});
    }
    return;
  }
  if (clickAction === 'TAKE_SLOT' && typeof clickActionData?.slot === 'string') {
    const row = widgetData().rows.find((r) => r.slot === clickActionData.slot);
    const dose = row && row.status === 'open' && row.due ? dosesOn(repo.getMeds(), row.slot.split('|')[1]).find((d) => d.slot === row.slot) : null;
    if (dose) await logDose(dose, 'taken').catch(() => {});
  }
}

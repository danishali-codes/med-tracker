import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { groupKey } from '../domain/reminders';
import { answerDoses, snoozeGroup } from '../notifications/reminders';
import { refreshSurfaces } from '../surfaces';
import { renderWidgetNamed } from './update';
import { widgetData } from './data';

/** Runs in the background when a widget is added, resized, refreshed or tapped. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && (await handleClick(clickAction, clickActionData))) {
    // The other widgets, the watch tile and caregivers see the press too.
    await refreshSurfaces();
  }
  renderWidget(renderWidgetNamed(widgetInfo.widgetName, widgetInfo.width, widgetInfo.height));
}

/** Widget buttons use the same path as notification buttons and the watch. True when something changed. */
async function handleClick(clickAction: string | undefined, clickActionData: Record<string, unknown> | undefined): Promise<boolean> {
  const data = widgetData();
  if (clickAction === 'TAKE_NEXT' || clickAction === 'SNOOZE_NEXT') {
    const next = data.next;
    // Only act on the time the widget showed, in case the day moved on since.
    if (!next || !next.due || next.time !== clickActionData?.time) return false;
    if (clickAction === 'TAKE_NEXT') await answerDoses(next.doses, 'taken').catch(() => {});
    else await snoozeGroup(groupKey(data.date, next.time), data.snoozeMinutes).catch(() => {});
    return true;
  }
  if (clickAction === 'TAKE_SLOT' && typeof clickActionData?.slot === 'string') {
    const row = data.rows.find((r) => r.slot === clickActionData.slot);
    const dose = row && row.status === 'open' && row.due ? row.dose : null;
    if (!dose) return false;
    await answerDoses([dose], 'taken').catch(() => {});
    return true;
  }
  return false;
}

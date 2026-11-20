// Registered from index.ts before the app renders, so these run even when the app is closed.
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { syncNow } from '../sync/engine';
import { refreshSurfaces } from '../surfaces';
import { autoBackupIfDue } from '../backup/backup';
import { refreshWidgetNow } from '../widget/update';
import { pushToWatchNow } from '../wear/sync';
import { handleReminderAction, rescheduleAll } from './reminders';

const NOTIFICATION_TASK = 'med-reminder-response';
const REFRESH_TASK = 'med-reminder-refresh';

// Android runs this when Taken / Snooze / Skip is pressed while the app is in the background or closed.
TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  if ('actionIdentifier' in data) {
    await handleReminderAction(data.actionIdentifier, data.notification.request.content.data);
    // Widgets, the watch tile and caregivers see the answer right away.
    await refreshSurfaces();
  }
});

// Tops up the schedule a couple of times a day in case the app isn't opened for a while.
TaskManager.defineTask(REFRESH_TASK, async () => {
  try {
    await rescheduleAll();
    await refreshWidgetNow();
    await pushToWatchNow();
    await syncNow().catch(() => {});
    await autoBackupIfDue().catch(() => {});
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundTasks() {
  try {
    await Notifications.registerTaskAsync(NOTIFICATION_TASK);
  } catch (e) {
    console.warn('Could not register notification task', e);
  }
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(REFRESH_TASK))) {
      await BackgroundTask.registerTaskAsync(REFRESH_TASK, { minimumInterval: 6 * 60 });
    }
  } catch (e) {
    console.warn('Could not register refresh task', e);
  }
}

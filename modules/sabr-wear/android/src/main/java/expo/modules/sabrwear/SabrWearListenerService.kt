package expo.modules.sabrwear

import androidx.work.Data
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

/**
 * Messages from the watch tile: /sabr/take, /sabr/snooze or /sabr/refresh, with the day and
 * time the tile showed. They're handed to the app's JavaScript (SabrWearAction), which works
 * even while the app is closed.
 */
class SabrWearListenerService : WearableListenerService() {
  override fun onMessageReceived(event: MessageEvent) {
    val action = when (event.path) {
      "/sabr/take" -> "take"
      "/sabr/snooze" -> "snooze"
      "/sabr/refresh" -> "refresh"
      else -> return
    }
    val input = Data.Builder()
      .putString("action", action)
      .putString("body", String(event.data ?: ByteArray(0), Charsets.UTF_8))
      .build()
    val work = OneTimeWorkRequest.Builder(SabrWearTaskWorker::class.java).setInputData(input).build()
    WorkManager.getInstance(applicationContext).enqueue(work)
  }
}

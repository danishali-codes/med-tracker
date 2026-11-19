package expo.modules.sabrwear

import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

const val PATH_TODAY = "/sabr/today"

class SabrWearModule : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext) { "No React context" }.applicationContext

  override fun definition() = ModuleDefinition {
    Name("SabrWear")

    // Replaces the one data item the watch tile reads. Data items stay in sync between the
    // paired phone and watch, so the tile updates even if the watch was away for a while.
    AsyncFunction("sendToday") { json: String ->
      val request = PutDataMapRequest.create(PATH_TODAY).apply {
        dataMap.putString("json", json)
        dataMap.putLong("sent", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()
      Tasks.await(Wearable.getDataClient(context).putDataItem(request), 15, TimeUnit.SECONDS)
      Unit
    }

    AsyncFunction("clear") {
      val uri = Uri.Builder().scheme(PutDataRequest.WEAR_URI_SCHEME).path(PATH_TODAY).build()
      Tasks.await(Wearable.getDataClient(context).deleteDataItems(uri), 15, TimeUnit.SECONDS)
      Unit
    }

    AsyncFunction("connectedWatches") {
      Tasks.await(Wearable.getNodeClient(context).connectedNodes, 10, TimeUnit.SECONDS).map { it.displayName }
    }
  }
}

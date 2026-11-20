package expo.modules.sabrwear

import android.net.Uri
import com.google.android.gms.tasks.Task
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

const val PATH_TODAY = "/sabr/today"
const val CAPABILITY = "sabr_tile"

class SabrWearModule : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext) { "No React context" }.applicationContext

  override fun definition() = ModuleDefinition {
    Name("SabrWear")

    // Replaces the one data item the watch tile reads. Data items stay in sync between the
    // paired phone and watch, so the tile updates even if the watch was away for a while.
    // These answer through the Play services callbacks instead of waiting on the thread, so a
    // slow data layer never holds up other native calls (database, notifications).
    AsyncFunction("sendToday") { json: String, promise: Promise ->
      val request = PutDataMapRequest.create(PATH_TODAY).apply {
        dataMap.putString("json", json)
        dataMap.putLong("sent", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()
      settle(Wearable.getDataClient(context).putDataItem(request), promise) { null }
    }

    AsyncFunction("clear") { promise: Promise ->
      val uri = Uri.Builder().scheme(PutDataRequest.WEAR_URI_SCHEME).path(PATH_TODAY).build()
      settle(Wearable.getDataClient(context).deleteDataItems(uri), promise) { null }
    }

    // Connected watches, split by whether the Sabr watch app is on them. The watch app
    // declares the "sabr_tile" capability, so a watch without it is listed separately.
    AsyncFunction("watchStatus") { promise: Promise ->
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes ->
          Wearable.getCapabilityClient(context).getCapability(CAPABILITY, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { info ->
              val ids = info.nodes.map { it.id }.toSet()
              promise.resolve(
                mapOf(
                  "withSabr" to nodes.filter { it.id in ids }.map { it.displayName },
                  "others" to nodes.filter { it.id !in ids }.map { it.displayName },
                ),
              )
            }
            .addOnFailureListener { promise.resolve(mapOf("withSabr" to emptyList<String>(), "others" to nodes.map { it.displayName })) }
        }
        .addOnFailureListener { promise.reject("ERR_SABR_WEAR", it.message, it) }
    }
  }

  private fun <T> settle(task: Task<T>, promise: Promise, value: (T) -> Any?) {
    task
      .addOnSuccessListener { promise.resolve(value(it)) }
      .addOnFailureListener { promise.reject("ERR_SABR_WEAR", it.message, it) }
  }
}

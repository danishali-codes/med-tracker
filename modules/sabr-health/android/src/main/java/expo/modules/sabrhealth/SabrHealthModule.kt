package expo.modules.sabrhealth

import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId

private const val REQUEST_CODE = 0x5ab4

/**
 * Reads steps, sleep and heart rate from Health Connect, where Samsung Health and most watches
 * share them. Read-only: Sabr never writes to Health Connect, and what it reads stays in memory
 * on the phone.
 */
class SabrHealthModule : Module() {
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private var pending: Promise? = null

  private val perms = mapOf(
    "steps" to HealthPermission.getReadPermission(StepsRecord::class),
    "sleep" to HealthPermission.getReadPermission(SleepSessionRecord::class),
    "heartRate" to HealthPermission.getReadPermission(HeartRateRecord::class),
    "restingHeartRate" to HealthPermission.getReadPermission(RestingHeartRateRecord::class),
  )

  private val context
    get() = requireNotNull(appContext.reactContext) { "No React context" }.applicationContext

  private fun client() = HealthConnectClient.getOrCreate(context)

  private fun names(granted: Set<String>): List<String> = perms.filter { it.value in granted }.keys.toList()

  override fun definition() = ModuleDefinition {
    Name("SabrHealth")

    OnDestroy { scope.cancel() }

    // "ready", "needsInstall" (Health Connect missing or out of date) or "unavailable".
    Function("status") {
      when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> "ready"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "needsInstall"
        else -> "unavailable"
      }
    }

    AsyncFunction("granted") Coroutine { ->
      names(client().permissionController.getGrantedPermissions())
    }

    // Shows Health Connect's own screen where you pick what Sabr may read.
    AsyncFunction("request") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_SABR_HEALTH", "No screen to ask from", null)
        return@AsyncFunction
      }
      pending?.resolve(emptyList<String>())
      pending = promise
      try {
        val intent = PermissionController.createRequestPermissionResultContract().createIntent(activity, perms.values.toSet())
        activity.startActivityForResult(intent, REQUEST_CODE)
      } catch (e: Exception) {
        pending = null
        promise.reject("ERR_SABR_HEALTH", e.message, e)
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val p = pending ?: return@OnActivityResult
      pending = null
      scope.launch {
        try {
          p.resolve(names(client().permissionController.getGrantedPermissions()))
        } catch (e: Exception) {
          p.resolve(emptyList<String>())
        }
      }
    }

    // Health Connect's settings, where access can be changed or taken back.
    Function("openSettings") {
      val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    // One entry per day from `from` to `to` (inclusive, YYYY-MM-DD, phone's time zone) that
    // has any data. Only reads the kinds you allowed.
    AsyncFunction("daily") Coroutine { from: String, to: String ->
      readDaily(LocalDate.parse(from), LocalDate.parse(to))
    }
  }

  private suspend fun readDaily(from: LocalDate, to: LocalDate): List<Map<String, Any>> {
    val c = client()
    val granted = c.permissionController.getGrantedPermissions()
    val has = { kind: String -> perms.getValue(kind) in granted }
    val start = from.atStartOfDay()
    val end = to.plusDays(1).atStartOfDay()
    val days = sortedMapOf<String, MutableMap<String, Any>>()
    fun day(d: LocalDate) = days.getOrPut(d.toString()) { mutableMapOf("date" to d.toString()) }

    val metrics = mutableSetOf<AggregateMetric<*>>()
    if (has("steps")) metrics += StepsRecord.COUNT_TOTAL
    if (has("heartRate")) metrics += setOf(HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MIN, HeartRateRecord.BPM_MAX)
    if (has("restingHeartRate")) metrics += RestingHeartRateRecord.BPM_AVG
    if (metrics.isNotEmpty()) {
      // Health Connect merges overlapping sources (phone and watch) for these totals.
      val groups = c.aggregateGroupByPeriod(
        AggregateGroupByPeriodRequest(metrics, TimeRangeFilter.between(start, end), Period.ofDays(1))
      )
      for (g in groups) {
        val r = g.result
        val values = listOfNotNull(
          r[StepsRecord.COUNT_TOTAL]?.let { "steps" to it.toDouble() },
          r[HeartRateRecord.BPM_AVG]?.let { "hrAvg" to it.toDouble() },
          r[HeartRateRecord.BPM_MIN]?.let { "hrMin" to it.toDouble() },
          r[HeartRateRecord.BPM_MAX]?.let { "hrMax" to it.toDouble() },
          r[RestingHeartRateRecord.BPM_AVG]?.let { "restingHr" to it.toDouble() },
        )
        if (values.isNotEmpty()) day(g.startTime.toLocalDate()).putAll(values)
      }
    }

    if (has("sleep")) {
      // A night counts for the day you woke up. Start a day early for nights that began the
      // evening before `from`.
      val zone = ZoneId.systemDefault()
      val sessions = mutableListOf<SleepSessionRecord>()
      var token: String? = null
      do {
        val res = c.readRecords(
          ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.between(start.minusDays(1), end), pageToken = token)
        )
        sessions += res.records
        token = res.pageToken
      } while (token != null)

      // When two apps both logged the same night, keep the first and skip the overlap.
      var lastEnd = Instant.MIN
      for (s in sessions.sortedBy { it.startTime }) {
        if (s.startTime < lastEnd) continue
        lastEnd = s.endTime
        val woke = s.endTime.atZone(zone).toLocalDate()
        if (woke < from || woke > to) continue
        var ms = Duration.between(s.startTime, s.endTime).toMillis()
        for (stage in s.stages) {
          if (stage.stage == SleepSessionRecord.STAGE_TYPE_AWAKE || stage.stage == SleepSessionRecord.STAGE_TYPE_OUT_OF_BED) {
            ms -= Duration.between(stage.startTime, stage.endTime).toMillis()
          }
        }
        if (ms <= 0) continue
        val d = day(woke)
        d["sleepMin"] = ((d["sleepMin"] as? Double) ?: 0.0) + ms / 60000.0
      }
    }

    return days.values.toList()
  }
}

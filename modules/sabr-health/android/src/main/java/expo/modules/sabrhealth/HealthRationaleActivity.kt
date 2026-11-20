package expo.modules.sabrhealth

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * Health Connect opens this when you tap "why does Sabr want this" or Sabr's privacy link.
 * It opens Sabr's Health data page, which explains what is read and that it never leaves
 * the phone.
 */
class HealthRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      startActivity(
        Intent(Intent.ACTION_VIEW, Uri.parse("medtracker://health"))
          .setPackage(packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    } catch (_: Exception) {
    }
    finish()
  }
}

package expo.modules.sabrcrypto

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

private const val B64 = Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP

/**
 * Password stretching in native code. The JavaScript version (src/backup/crypto.ts) gives
 * the same result but is many times slower on the phone, so this one can afford far more
 * rounds, which makes a stolen backup much slower to guess at.
 */
class SabrCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SabrCrypto")

    // PBKDF2-HMAC-SHA512 over raw bytes, so the password's encoding is exactly what the JS
    // side sent (UTF-8). Runs off the JS thread.
    AsyncFunction("pbkdf2Sha512") { passwordB64: String, saltB64: String, iterations: Int, length: Int ->
      require(iterations in 1..10_000_000) { "Bad iteration count" }
      require(length in 1..64) { "Key too long" }
      val password = Base64.decode(passwordB64, B64)
      val salt = Base64.decode(saltB64, B64)
      val mac = Mac.getInstance("HmacSHA512")
      // HMAC pads short keys with zeros, so an empty password is the same key as one zero
      // byte (SecretKeySpec refuses an empty array).
      mac.init(SecretKeySpec(if (password.isEmpty()) ByteArray(1) else password, "HmacSHA512"))
      mac.update(salt)
      mac.update(byteArrayOf(0, 0, 0, 1))
      var u = mac.doFinal()
      val t = u.copyOf()
      for (i in 1 until iterations) {
        u = mac.doFinal(u)
        for (j in t.indices) t[j] = (t[j].toInt() xor u[j].toInt()).toByte()
      }
      password.fill(0)
      Base64.encodeToString(t.copyOf(length), B64)
    }
  }
}

package com.outfit

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource
import javax.crypto.spec.SecretKeySpec

/**
 * Fingerprint app lock, bound to hardware.
 *
 * - The Firebase session is stored as a hybrid-encrypted blob: a random AES-256-GCM key encrypts
 *   the session JSON and an Android Keystore RSA-2048 key (OAEP SHA-256) wraps the AES key.
 * - The RSA public key encrypts without auth, so token refreshes can be saved any time.
 * - The RSA private key never leaves the Keystore (StrongBox when the phone has it, else TEE),
 *   needs a strong biometric for every single use (BiometricPrompt + CryptoObject), and is
 *   destroyed by Android when a new fingerprint is enrolled. No device PIN fallback.
 * - Tamper check: the APK signing certificate must match [EXPECTED_SIGNING_SHA256].
 */
class AppLockModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  // True when a strong (class 3) biometric such as a fingerprint is enrolled
  @ReactMethod
  fun isAvailable(promise: Promise) {
    try {
      val r = BiometricManager.from(ctx).canAuthenticate(BIOMETRIC_STRONG)
      promise.resolve(r == BiometricManager.BIOMETRIC_SUCCESS)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  // Plain fingerprint prompt (no crypto). Strong biometric only, never the device PIN.
  // Resolves "success", "cancelled", "password" (negative button), "lockout" or "error:<message>"
  @ReactMethod
  fun authenticate(title: String, subtitle: String, negativeText: String, promise: Promise) {
    val activity = ctx.currentActivity as? FragmentActivity
    if (activity == null) {
      promise.resolve("error:App is not in the foreground")
      return
    }
    UiThreadUtil.runOnUiThread {
      var done = false
      fun finish(result: String) {
        if (done) return
        done = true
        promise.resolve(result)
      }
      try {
        val prompt = BiometricPrompt(
          activity,
          ContextCompat.getMainExecutor(activity),
          object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              finish("success")
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              finish(mapError(errorCode, errString))
            }
          },
        )
        prompt.authenticate(promptInfo(title, subtitle, negativeText))
      } catch (e: Exception) {
        finish("error:${e.message ?: "Biometric prompt failed"}")
      }
    }
  }

  // ── Hardware-bound session key ──

  @ReactMethod
  fun hasKey(promise: Promise) {
    try {
      promise.resolve(keyStore().containsAlias(KEY_ALIAS))
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  // Replaces the key pair. Resolves "strongbox", "tee" or "error:<message>"
  @ReactMethod
  fun createKey(preferStrongBox: Boolean, promise: Promise) {
    try {
      deleteKeyQuietly()
      val wantStrongBox = preferStrongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
        ctx.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)
      if (wantStrongBox) {
        try {
          generateKeyPair(true)
          promise.resolve("strongbox")
          return
        } catch (e: Exception) {
          // StrongBoxUnavailableException or an unsupported parameter: use the TEE instead
          deleteKeyQuietly()
        }
      }
      generateKeyPair(false)
      promise.resolve("tee")
    } catch (e: Exception) {
      deleteKeyQuietly()
      promise.resolve("error:${e.message ?: e.javaClass.simpleName}")
    }
  }

  @ReactMethod
  fun deleteKey(promise: Promise) {
    deleteKeyQuietly()
    promise.resolve(true)
  }

  // Encrypts with the public key (no fingerprint). Resolves the blob, or "error:<message>"
  @ReactMethod
  fun encrypt(plain: String, promise: Promise) {
    try {
      if (!signatureOk(ctx)) {
        promise.resolve("error:tampered")
        return
      }
      val ks = keyStore()
      val cert = ks.getCertificate(KEY_ALIAS)
      if (cert == null) {
        promise.resolve("error:nokey")
        return
      }
      // Software copy of the public key: public-key operations need no user auth
      val pub = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(cert.publicKey.encoded))
      val rsa = Cipher.getInstance(RSA_TRANSFORM)
      rsa.init(Cipher.ENCRYPT_MODE, pub, oaepSpec())

      val kg = KeyGenerator.getInstance("AES")
      kg.init(256)
      val aesKey = kg.generateKey()
      val iv = ByteArray(12)
      SecureRandom().nextBytes(iv)
      val aes = Cipher.getInstance(AES_TRANSFORM)
      aes.init(Cipher.ENCRYPT_MODE, SecretKeySpec(aesKey.encoded, "AES"), GCMParameterSpec(128, iv))
      aes.updateAAD(AAD)
      val ct = aes.doFinal(plain.toByteArray(Charsets.UTF_8))
      val wrapped = rsa.doFinal(aesKey.encoded)
      promise.resolve("v1." + b64(wrapped) + "." + b64(iv) + "." + b64(ct))
    } catch (e: Exception) {
      promise.resolve("error:${e.message ?: e.javaClass.simpleName}")
    }
  }

  /**
   * Fingerprint prompt bound to the private key; on success unwraps the AES key and decrypts.
   * Resolves "ok:<plaintext>", "cancelled", "password" (negative button), "lockout",
   * "invalidated" (key gone / new fingerprint enrolled), "failed" (blob can't be decrypted),
   * "tampered" or "error:<message>".
   */
  @ReactMethod
  fun decrypt(blob: String, title: String, subtitle: String, negativeText: String, promise: Promise) {
    if (!signatureOk(ctx)) {
      promise.resolve("tampered")
      return
    }
    val parts = blob.split(".")
    if (parts.size != 4 || parts[0] != "v1") {
      promise.resolve("failed")
      return
    }
    val decoded: List<ByteArray>? = try {
      listOf(unb64(parts[1]), unb64(parts[2]), unb64(parts[3]))
    } catch (e: Exception) {
      null
    }
    if (decoded == null) {
      promise.resolve("failed")
      return
    }
    val wrapped = decoded[0]
    val iv = decoded[1]
    val ct = decoded[2]
    // "" = ready, otherwise the result to return without prompting
    var initResult = ""
    val rsa: Cipher? = try {
      val key = keyStore().getKey(KEY_ALIAS, null) as? PrivateKey
      if (key == null) {
        initResult = "invalidated"
        null
      } else {
        val c = Cipher.getInstance(RSA_TRANSFORM)
        c.init(Cipher.DECRYPT_MODE, key, oaepSpec())
        c
      }
    } catch (e: KeyPermanentlyInvalidatedException) {
      deleteKeyQuietly()
      initResult = "invalidated"
      null
    } catch (e: Exception) {
      initResult = "failed"
      null
    }
    if (rsa == null) {
      promise.resolve(if (initResult.isEmpty()) "failed" else initResult)
      return
    }
    val activity = ctx.currentActivity as? FragmentActivity
    if (activity == null) {
      promise.resolve("error:App is not in the foreground")
      return
    }
    UiThreadUtil.runOnUiThread {
      var done = false
      fun finish(result: String) {
        if (done) return
        done = true
        promise.resolve(result)
      }
      try {
        val prompt = BiometricPrompt(
          activity,
          ContextCompat.getMainExecutor(activity),
          object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              try {
                val c = result.cryptoObject?.cipher
                if (c == null) {
                  finish("failed")
                  return
                }
                val aesKey = c.doFinal(wrapped)
                val aes = Cipher.getInstance(AES_TRANSFORM)
                aes.init(Cipher.DECRYPT_MODE, SecretKeySpec(aesKey, "AES"), GCMParameterSpec(128, iv))
                aes.updateAAD(AAD)
                val plain = aes.doFinal(ct)
                finish("ok:" + String(plain, Charsets.UTF_8))
              } catch (e: Exception) {
                finish("failed")
              }
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              finish(mapError(errorCode, errString))
            }
          },
        )
        prompt.authenticate(promptInfo(title, subtitle, negativeText), BiometricPrompt.CryptoObject(rsa))
      } catch (e: Exception) {
        finish("error:${e.message ?: "Biometric prompt failed"}")
      }
    }
  }

  // ── Tamper check ──

  // Resolves { ok: Boolean, sha256: "AA:BB:..." (first signer) }
  @ReactMethod
  fun verifySignature(promise: Promise) {
    try {
      val hashes = signingSha256(ctx)
      val map = com.facebook.react.bridge.Arguments.createMap()
      map.putBoolean("ok", hashes.any { it.equals(EXPECTED_SIGNING_SHA256, ignoreCase = true) })
      map.putString("sha256", hashes.firstOrNull() ?: "")
      promise.resolve(map)
    } catch (e: Exception) {
      val map = com.facebook.react.bridge.Arguments.createMap()
      map.putBoolean("ok", false)
      map.putString("sha256", "")
      promise.resolve(map)
    }
  }

  // ── Screen privacy ──

  // enabled: app lock is on (hide the recents preview); screenShown: lock screen is visible
  @ReactMethod
  fun setPrivacy(enabled: Boolean, screenShown: Boolean, promise: Promise) {
    lockEnabled = enabled
    lockScreenShown = screenShown
    val activity = ctx.currentActivity
    if (activity != null) {
      UiThreadUtil.runOnUiThread { applyPrivacy(activity, false) }
    }
    promise.resolve(true)
  }

  // ── helpers ──

  private fun promptInfo(title: String, subtitle: String, negativeText: String): BiometricPrompt.PromptInfo =
    BiometricPrompt.PromptInfo.Builder()
      .setTitle(title)
      .setSubtitle(subtitle)
      // Strong biometric only: no device PIN / pattern fallback
      .setAllowedAuthenticators(BIOMETRIC_STRONG)
      .setNegativeButtonText(negativeText)
      .setConfirmationRequired(false)
      .build()

  private fun mapError(errorCode: Int, errString: CharSequence): String = when (errorCode) {
    BiometricPrompt.ERROR_NEGATIVE_BUTTON -> "password"
    BiometricPrompt.ERROR_USER_CANCELED, BiometricPrompt.ERROR_CANCELED -> "cancelled"
    BiometricPrompt.ERROR_LOCKOUT, BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "lockout"
    else -> "error:$errString"
  }

  private fun generateKeyPair(strongBox: Boolean) {
    val b = KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
    )
      .setKeySize(2048)
      .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA1)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
      .setUserAuthenticationRequired(true)
      // A newly enrolled fingerprint permanently invalidates the key
      .setInvalidatedByBiometricEnrollment(true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // 0 = auth for every use; strong biometric only (no device credential)
      b.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
    } else {
      @Suppress("DEPRECATION")
      b.setUserAuthenticationValidityDurationSeconds(-1)
    }
    if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      b.setIsStrongBoxBacked(true)
    }
    val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore")
    kpg.initialize(b.build())
    kpg.generateKeyPair()
  }

  private fun deleteKeyQuietly() {
    try {
      val ks = keyStore()
      if (ks.containsAlias(KEY_ALIAS)) ks.deleteEntry(KEY_ALIAS)
    } catch (e: Exception) {
      // ignore
    }
  }

  private fun keyStore(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  // The Keystore's OAEP supports MGF1 with SHA-1 on every API level
  private fun oaepSpec() = OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT)

  private fun b64(b: ByteArray): String = Base64.encodeToString(b, Base64.NO_WRAP)
  private fun unb64(s: String): ByteArray = Base64.decode(s, Base64.NO_WRAP)

  companion object {
    const val NAME = "OutfitAppLock"
    private const val KEY_ALIAS = "outfit_session_rsa_v1"
    private const val RSA_TRANSFORM = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding"
    private const val AES_TRANSFORM = "AES/GCM/NoPadding"
    private val AAD = "com.outfit/session/v1".toByteArray(Charsets.UTF_8)

    /**
     * SHA-256 of the certificate that signs the official APK (today: android/app/debug.keystore,
     * alias androiddebugkey, which build.gradle uses for release too).
     *
     * If the signing keystore ever changes, put the new value here before building, or every
     * install will show the "modified copy" screen. Get it with:
     *   keytool -list -v -keystore <your.keystore> -alias <alias>   (the "SHA256:" line)
     * or run `./gradlew signingReport` and copy the release variant's "SHA-256" line.
     */
    const val EXPECTED_SIGNING_SHA256 =
      "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"

    @Volatile var lockEnabled = false
    @Volatile var lockScreenShown = false

    // Called from MainActivity onPause (paused = true) / onResume (paused = false) and setPrivacy
    fun applyPrivacy(activity: Activity, paused: Boolean) {
      try {
        val secure = lockScreenShown || (lockEnabled && paused && Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU)
        if (secure) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          // Android 13+: no recents thumbnail while the lock is on; screenshots still allowed
          activity.setRecentsScreenshotEnabled(!lockEnabled)
        }
      } catch (e: Exception) {
        // ignore
      }
    }

    @Suppress("DEPRECATION")
    fun signingSha256(context: Context): List<String> {
      val pm = context.packageManager
      val pkg = context.packageName
      val certs: List<ByteArray> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES)
        val signers = info.signingInfo?.apkContentsSigners
        signers?.map { it.toByteArray() } ?: emptyList()
      } else {
        val info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES)
        info.signatures?.map { it.toByteArray() } ?: emptyList()
      }
      return certs.map { cert ->
        MessageDigest.getInstance("SHA-256").digest(cert).joinToString(":") { "%02X".format(it) }
      }
    }

    @Volatile private var signatureChecked: Boolean? = null

    fun signatureOk(context: Context): Boolean {
      signatureChecked?.let { return it }
      val ok = try {
        signingSha256(context).any { it.equals(EXPECTED_SIGNING_SHA256, ignoreCase = true) }
      } catch (e: Exception) {
        false
      }
      signatureChecked = ok
      return ok
    }
  }
}

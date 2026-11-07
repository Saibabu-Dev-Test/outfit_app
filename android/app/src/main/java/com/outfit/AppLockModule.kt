package com.outfit

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

// Fingerprint app lock with the phone's own biometrics (PIN/pattern as fallback)
class AppLockModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  // True when a fingerprint (or other biometric) is enrolled
  @ReactMethod
  fun isAvailable(promise: Promise) {
    try {
      val r = BiometricManager.from(ctx).canAuthenticate(BIOMETRIC_WEAK)
      promise.resolve(r == BiometricManager.BIOMETRIC_SUCCESS)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  // Resolves "success", "cancelled" or "error:<message>"
  @ReactMethod
  fun authenticate(title: String, subtitle: String, promise: Promise) {
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
              val cancelled = errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                errorCode == BiometricPrompt.ERROR_CANCELED
              finish(if (cancelled) "cancelled" else "error:$errString")
            }
          },
        )
        val info = BiometricPrompt.PromptInfo.Builder()
          .setTitle(title)
          .setSubtitle(subtitle)
          // Fingerprint, or the phone PIN/pattern/password
          .setAllowedAuthenticators(BIOMETRIC_WEAK or DEVICE_CREDENTIAL)
          .build()
        prompt.authenticate(info)
      } catch (e: Exception) {
        finish("error:${e.message ?: "Biometric prompt failed"}")
      }
    }
  }

  companion object {
    const val NAME = "OutfitAppLock"
  }
}

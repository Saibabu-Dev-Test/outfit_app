package com.outfit

import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.MessageDigest

// Earn anti-fraud: one account per phone. Returns SHA-256 of ANDROID_ID (per app signing key + user
// on Android 8+, survives reinstall) salted with the package name, so the raw id never leaves the phone.
class DeviceIdModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitDeviceId"

  @ReactMethod
  fun getDeviceHash(promise: Promise) {
    try {
      val id = Settings.Secure.getString(reactApplicationContext.contentResolver, Settings.Secure.ANDROID_ID)
      if (id.isNullOrBlank()) { promise.resolve(null); return }
      val md = MessageDigest.getInstance("SHA-256")
      val bytes = md.digest("${reactApplicationContext.packageName}:$id".toByteArray(Charsets.UTF_8))
      promise.resolve(bytes.joinToString("") { "%02x".format(it) })
    } catch (t: Throwable) {
      promise.resolve(null)
    }
  }
}

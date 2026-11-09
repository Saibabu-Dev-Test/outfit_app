package com.outfit

import android.os.Build
import androidx.core.content.pm.PackageInfoCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * In-app update for the sideloaded APK (no Play Store):
 * - getInfo: versionCode / versionName of this install + the phone's CPU types
 * The app never downloads or installs APKs itself (no REQUEST_INSTALL_PACKAGES): an update
 * opens the download page in the browser and the user installs it like any other file.
 */
class AppUpdateModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  @ReactMethod
  fun getInfo(promise: Promise) {
    try {
      @Suppress("DEPRECATION")
      val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
      val map = Arguments.createMap()
      map.putDouble("versionCode", PackageInfoCompat.getLongVersionCode(info).toDouble())
      map.putString("versionName", info.versionName ?: "")
      val abis = Arguments.createArray()
      Build.SUPPORTED_ABIS.forEach { abis.pushString(it) }
      map.putArray("abis", abis)
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("INFO_FAILED", e.message ?: "Could not read the app version", e)
    }
  }


  companion object {
    const val NAME = "OutfitAppUpdate"
  }
}

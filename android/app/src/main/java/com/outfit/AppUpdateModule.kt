package com.outfit

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.FileProvider
import androidx.core.content.pm.PackageInfoCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * In-app update for the sideloaded APK (no Play Store):
 * - getInfo: versionCode / versionName of this install + the phone's CPU types
 * - canInstall / openInstallSettings: the "Install unknown apps" permission (Android 8+)
 * - downloadAndInstall: DownloadManager -> app-specific Downloads folder -> FileProvider ->
 *   package installer (ACTION_VIEW). Resolves "installing" when the installer opens.
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

  @ReactMethod
  fun canInstall(promise: Promise) {
    try {
      promise.resolve(
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ctx.packageManager.canRequestPackageInstalls(),
      )
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  // Settings > Install unknown apps, for this app
  @ReactMethod
  fun openInstallSettings(promise: Promise) {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.packageName))
      } else {
        @Suppress("DEPRECATION")
        Intent(Settings.ACTION_SECURITY_SETTINGS)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OPEN_FAILED", e.message ?: "Could not open settings", e)
    }
  }

  @ReactMethod
  fun downloadAndInstall(url: String, title: String, promise: Promise) {
    try {
      val dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
      if (dir == null) {
        promise.reject("NO_STORAGE", "Storage is not available")
        return
      }
      // Old update files would be installed instead of the new one: start clean
      dir.listFiles()?.filter { it.name.startsWith(FILE_PREFIX) }?.forEach { it.delete() }
      val fileName = FILE_PREFIX + System.currentTimeMillis() + ".apk"
      val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val req = DownloadManager.Request(Uri.parse(url))
        .setTitle(title)
        .setDescription("Downloading the latest OUTFIT app")
        .setMimeType(APK_MIME)
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setDestinationInExternalFilesDir(ctx, Environment.DIRECTORY_DOWNLOADS, fileName)
      val id = dm.enqueue(req)
      val file = File(dir, fileName)
      poll(dm, id, file, promise, 0)
    } catch (e: Exception) {
      promise.reject("DOWNLOAD_FAILED", e.message ?: "Download failed", e)
    }
  }

  // Checks the download every 700 ms (max ~10 min), then opens the installer
  private fun poll(dm: DownloadManager, id: Long, file: File, promise: Promise, tries: Int) {
    Handler(Looper.getMainLooper()).postDelayed({
      try {
        var status = -1
        dm.query(DownloadManager.Query().setFilterById(id))?.use { c ->
          if (c.moveToFirst()) status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        }
        when {
          status == DownloadManager.STATUS_SUCCESSFUL -> {
            openInstaller(file)
            promise.resolve("installing")
          }
          status == DownloadManager.STATUS_FAILED || status == -1 ->
            promise.reject("DOWNLOAD_FAILED", "Download failed")
          tries > 860 -> promise.reject("DOWNLOAD_TIMEOUT", "Download is taking too long")
          else -> poll(dm, id, file, promise, tries + 1)
        }
      } catch (e: Exception) {
        promise.reject("INSTALL_FAILED", e.message ?: "Could not open the installer", e)
      }
    }, 700)
  }

  private fun openInstaller(file: File) {
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".provider", file)
    val intent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, APK_MIME)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    ctx.startActivity(intent)
  }

  companion object {
    const val NAME = "OutfitAppUpdate"
    private const val FILE_PREFIX = "outfit-update-"
    private const val APK_MIME = "application/vnd.android.package-archive"
  }
}

package com.outfit

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Are notifications on for this app? (covers the Android 13+ permission and the app toggle)
class NotificationsModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  @ReactMethod
  fun areNotificationsEnabled(promise: Promise) {
    try {
      promise.resolve(NotificationManagerCompat.from(ctx).areNotificationsEnabled())
    } catch (e: Exception) {
      promise.reject("CHECK_FAILED", e.message ?: "Could not read notification settings", e)
    }
  }

  // Opens this app's notification settings (app details on old Android)
  @ReactMethod
  fun openNotificationSettings(promise: Promise) {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      try {
        val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))
        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(fallback)
        promise.resolve(true)
      } catch (e2: Exception) {
        promise.reject("OPEN_FAILED", e2.message ?: "Could not open settings", e2)
      }
    }
  }

  // Daily reminders at 8:00, 13:00 and 19:00 local time. Idempotent: call on every launch.
  @ReactMethod
  fun scheduleDaily(promise: Promise) {
    try {
      OutfitNotifier.scheduleDaily(ctx)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun cancelDaily(promise: Promise) {
    try {
      OutfitNotifier.cancelDaily(ctx)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  // Activity notification (likes, comments, follows, feedback) on the "activity" channel.
  // Resolves false when notifications are off.
  @ReactMethod
  fun postNotification(title: String, body: String, promise: Promise) {
    try {
      val id = 8000 + ((System.currentTimeMillis() / 1000L) % 100000L).toInt()
      promise.resolve(OutfitNotifier.post(ctx, OutfitNotifier.CHANNEL_ACTIVITY, id, title, body))
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  companion object {
    const val NAME = "OutfitNotifications"
  }
}

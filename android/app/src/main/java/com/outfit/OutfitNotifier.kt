package com.outfit

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.Calendar

// Local notifications without a server or extra library:
//  - daily reminders at 8:00, 13:00 and 19:00 (AlarmManager.setAndAllowWhileIdle, inexact, so no
//    exact-alarm permission; each alarm re-arms the next day's when it fires)
//  - activity notifications posted by the app while it runs (likes, comments, follows, feedback)
object OutfitNotifier {
  const val CHANNEL_DAILY = "daily"
  const val CHANNEL_ACTIVITY = "activity"
  const val ACTION_DAILY = "com.outfit.DAILY_NOTIFICATION"
  const val EXTRA_SLOT = "slot"
  private const val PREFS = "outfit_notifications"
  private const val KEY_DAILY_ON = "daily_on"

  data class Slot(val hour: Int, val minute: Int, val title: String, val body: String)

  val SLOTS = listOf(
    Slot(8, 0, "Good morning! ☀️", "Good morning! Check today's lucky colour 🎨"),
    Slot(13, 0, "Outfit votes", "Votes are coming in, see today's outfits 👗"),
    Slot(19, 0, "Your circles", "Evening circle updates are waiting ✨"),
  )

  fun ensureChannels(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_DAILY, "Daily reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Lucky colour, votes and circle reminders (8 AM, 1 PM, 7 PM)"
      },
    )
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ACTIVITY, "Activity", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Likes, comments, follows and feedback"
      },
    )
  }

  private fun canPost(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return false
    return NotificationManagerCompat.from(ctx).areNotificationsEnabled()
  }

  private fun openAppIntent(ctx: Context, requestCode: Int): PendingIntent {
    val i = Intent(ctx, MainActivity::class.java)
      .setAction(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_LAUNCHER)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      ctx, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  // Posts one notification. Returns false when notifications are off.
  fun post(ctx: Context, channel: String, id: Int, title: String, body: String): Boolean {
    ensureChannels(ctx)
    if (!canPost(ctx)) return false
    val n = NotificationCompat.Builder(ctx, channel)
      .setSmallIcon(R.drawable.ic_stat_outfit)
      .setColor(0xFFE91E63.toInt())
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(
        if (channel == CHANNEL_ACTIVITY) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT,
      )
      .setContentIntent(openAppIntent(ctx, id))
      .build()
    return try {
      NotificationManagerCompat.from(ctx).notify(id, n)
      true
    } catch (e: SecurityException) {
      false
    }
  }

  // ── Daily reminders ──

  fun isDailyOn(ctx: Context): Boolean =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_DAILY_ON, false)

  private fun dailyIntent(ctx: Context, slot: Int): PendingIntent {
    val i = Intent(ctx, DailyNotificationReceiver::class.java).setAction(ACTION_DAILY).putExtra(EXTRA_SLOT, slot)
    return PendingIntent.getBroadcast(
      ctx, 7100 + slot, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  // Next local time hh:mm strictly after now (+1 min margin so a just-fired alarm moves to tomorrow)
  fun nextTrigger(hour: Int, minute: Int, now: Long = System.currentTimeMillis()): Long {
    val c = Calendar.getInstance().apply {
      timeInMillis = now
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    if (c.timeInMillis <= now + 60_000L) c.add(Calendar.DAY_OF_YEAR, 1)
    return c.timeInMillis
  }

  fun scheduleSlot(ctx: Context, slot: Int) {
    val s = SLOTS.getOrNull(slot) ?: return
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    // Same PendingIntent (request code per slot) replaces any earlier alarm: idempotent
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTrigger(s.hour, s.minute), dailyIntent(ctx, slot))
  }

  // Arms all three reminders (safe to call on every launch / boot)
  fun scheduleDaily(ctx: Context) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_DAILY_ON, true).apply()
    ensureChannels(ctx)
    for (i in SLOTS.indices) scheduleSlot(ctx, i)
  }

  fun cancelDaily(ctx: Context) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_DAILY_ON, false).apply()
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    for (i in SLOTS.indices) am.cancel(dailyIntent(ctx, i))
  }
}

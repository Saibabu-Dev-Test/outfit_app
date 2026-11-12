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
//  - colour-vote reminder: from 1:00 AM local time, every hour until today's colour is voted
//    (the app calls markColourVoted after the vote); then quiet until 1:00 AM the next day.
//    One alarm at a time (setAndAllowWhileIdle, re-armed by every fire), re-armed after reboot.
//  - activity notifications posted by the app while it runs (likes, comments, follows, feedback)
object OutfitNotifier {
  const val CHANNEL_DAILY = "daily"
  const val CHANNEL_ACTIVITY = "activity"
  const val ACTION_DAILY = "com.outfit.DAILY_NOTIFICATION"
  const val ACTION_VOTE = "com.outfit.VOTE_REMINDER"
  const val CHANNEL_VOTE = "vote"
  const val VOTE_NOTIFICATION_ID = 7200
  private const val VOTE_REQUEST_CODE = 7200
  private const val KEY_VOTE_ON = "vote_on"
  private const val KEY_VOTED_DAY = "voted_day"
  // Reminders run from this local hour until the vote (every hour)
  const val VOTE_START_HOUR = 1
  const val EXTRA_SLOT = "slot"
  // Optional JSON the app reads when the notification is tapped (e.g. like coins to flip)
  const val EXTRA_PAYLOAD = "outfit_payload"
  private const val PREFS = "outfit_notifications"
  private const val KEY_DAILY_ON = "daily_on"
  // First name of the signed-in user (saved by the app at login / profile update) for the 8 AM title
  private const val KEY_FIRST_NAME = "first_name"

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
      NotificationChannel(CHANNEL_VOTE, "Colour vote reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Hourly from 1 AM until you vote today's colour"
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

  private fun openAppIntent(ctx: Context, requestCode: Int, payload: String? = null): PendingIntent {
    val i = Intent(ctx, MainActivity::class.java)
      .setAction(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_LAUNCHER)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    if (!payload.isNullOrEmpty()) i.putExtra(EXTRA_PAYLOAD, payload)
    return PendingIntent.getActivity(
      ctx, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  // Posts one notification. Returns false when notifications are off.
  fun post(ctx: Context, channel: String, id: Int, title: String, body: String, payload: String? = null): Boolean {
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
      .setContentIntent(openAppIntent(ctx, id, payload))
      .build()
    return try {
      NotificationManagerCompat.from(ctx).notify(id, n)
      true
    } catch (e: SecurityException) {
      false
    }
  }

  // Payload of the notification the app was opened from; read once by the app (consumeLaunchPayload)
  @Volatile var pendingPayload: String? = null

  fun capturePayload(intent: Intent?) {
    try {
      val p = intent?.getStringExtra(EXTRA_PAYLOAD)
      if (!p.isNullOrEmpty()) {
        pendingPayload = p
        intent?.removeExtra(EXTRA_PAYLOAD)
      }
    } catch (_: Throwable) {}
  }

  // ── Daily reminders ──

  fun setFirstName(ctx: Context, name: String?) {
    val clean = name?.trim().orEmpty()
    val e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    if (clean.isEmpty()) e.remove(KEY_FIRST_NAME) else e.putString(KEY_FIRST_NAME, clean)
    e.apply()
  }

  // "Good morning, Priya! ☀️" when the name is known, else "Good morning! ☀️"
  fun morningTitle(ctx: Context): String {
    val name = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_FIRST_NAME, null)?.trim()
    return if (name.isNullOrEmpty()) "Good morning! ☀️" else "Good morning, $name! ☀️"
  }

  // Slot 0 (8 AM) is personalised; 1 PM and 7 PM keep their fixed titles
  fun titleFor(ctx: Context, slot: Int): String =
    if (slot == 0) morningTitle(ctx) else SLOTS[slot].title

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

  // ── Colour-vote reminder ──

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  // Local calendar day, same format as the app's localDateKey(): yyyy-MM-dd
  fun dayKey(now: Long = System.currentTimeMillis()): String {
    val c = Calendar.getInstance().apply { timeInMillis = now }
    return String.format(
      java.util.Locale.US, "%04d-%02d-%02d",
      c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH),
    )
  }

  fun isVoteReminderOn(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_VOTE_ON, false)

  fun votedToday(ctx: Context, now: Long = System.currentTimeMillis()): Boolean =
    prefs(ctx).getString(KEY_VOTED_DAY, null) == dayKey(now)

  private fun voteIntent(ctx: Context): PendingIntent {
    val i = Intent(ctx, DailyNotificationReceiver::class.java).setAction(ACTION_VOTE)
    return PendingIntent.getBroadcast(
      ctx, VOTE_REQUEST_CODE, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  // Next reminder: voted today -> tomorrow 1:00; before 1:00 -> today 1:00; otherwise the next
  // full hour (2:00, 3:00, ...), at least a minute ahead so a just-fired alarm moves on.
  fun nextVoteTrigger(ctx: Context, now: Long = System.currentTimeMillis()): Long {
    val c = Calendar.getInstance().apply {
      timeInMillis = now
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    val startToday = (c.clone() as Calendar).apply {
      set(Calendar.HOUR_OF_DAY, VOTE_START_HOUR)
      set(Calendar.MINUTE, 0)
    }
    if (votedToday(ctx, now)) {
      startToday.add(Calendar.DAY_OF_YEAR, 1)
      return startToday.timeInMillis
    }
    if (now + 60_000L < startToday.timeInMillis) return startToday.timeInMillis
    c.set(Calendar.MINUTE, 0)
    c.add(Calendar.HOUR_OF_DAY, 1)
    while (c.timeInMillis <= now + 60_000L) c.add(Calendar.HOUR_OF_DAY, 1)
    return c.timeInMillis
  }

  private fun armVote(ctx: Context) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    // Same PendingIntent replaces the earlier alarm: only one vote alarm exists at a time
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextVoteTrigger(ctx), voteIntent(ctx))
  }

  // Turns the reminder on and arms the next one (idempotent: call on every launch / boot)
  fun scheduleVoteReminder(ctx: Context) {
    prefs(ctx).edit().putBoolean(KEY_VOTE_ON, true).apply()
    ensureChannels(ctx)
    armVote(ctx)
  }

  // The user voted for `day` (yyyy-MM-dd; today when null): no more reminders until 1:00 tomorrow
  fun markColourVoted(ctx: Context, day: String?) {
    prefs(ctx).edit().putString(KEY_VOTED_DAY, if (day.isNullOrBlank()) dayKey() else day).apply()
    try {
      NotificationManagerCompat.from(ctx).cancel(VOTE_NOTIFICATION_ID)
    } catch (e: Exception) {
    }
    if (isVoteReminderOn(ctx)) armVote(ctx)
  }

  fun cancelVoteReminder(ctx: Context) {
    prefs(ctx).edit().putBoolean(KEY_VOTE_ON, false).apply()
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    am?.cancel(voteIntent(ctx))
    try {
      NotificationManagerCompat.from(ctx).cancel(VOTE_NOTIFICATION_ID)
    } catch (e: Exception) {
    }
  }

  // Alarm fired: remind (when not voted yet and it's 1:00 or later), then arm the next one
  fun onVoteAlarm(ctx: Context) {
    if (!isVoteReminderOn(ctx)) return
    val now = System.currentTimeMillis()
    val hour = Calendar.getInstance().apply { timeInMillis = now }.get(Calendar.HOUR_OF_DAY)
    if (!votedToday(ctx, now) && hour >= VOTE_START_HOUR) {
      post(
        ctx, CHANNEL_VOTE, VOTE_NOTIFICATION_ID,
        "🎨 Vote today's colour",
        "Today's colour vote is open. Tap to pick your colour before the day ends!",
      )
    }
    armVote(ctx)
  }
}

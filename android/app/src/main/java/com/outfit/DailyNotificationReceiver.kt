package com.outfit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Fires the daily reminder and re-arms it for tomorrow. Also re-arms all reminders after a
// reboot, an app update, or a clock / time-zone change.
class DailyNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val ctx = context.applicationContext
    when (intent.action) {
      OutfitNotifier.ACTION_DAILY -> {
        val slot = intent.getIntExtra(OutfitNotifier.EXTRA_SLOT, -1)
        val s = OutfitNotifier.SLOTS.getOrNull(slot) ?: return
        if (!OutfitNotifier.isDailyOn(ctx)) return
        OutfitNotifier.post(ctx, OutfitNotifier.CHANNEL_DAILY, 7100 + slot, s.title, s.body)
        OutfitNotifier.scheduleSlot(ctx, slot)
      }
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      "android.intent.action.QUICKBOOT_POWERON" -> {
        if (OutfitNotifier.isDailyOn(ctx)) OutfitNotifier.scheduleDaily(ctx)
      }
    }
  }
}

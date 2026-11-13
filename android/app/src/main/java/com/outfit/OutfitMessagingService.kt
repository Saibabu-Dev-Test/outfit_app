package com.outfit

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// Data-only FCM messages from .github/workflows/circle-poll-push.yml:
//   {type: 'circle_poll', title, body, circleId, messageId}
// Shown as a notification; tapping it opens outfit://circle/<circleId>/<messageId> (the poll's chat).
// Every step is guarded: a bad message is dropped, never a crash.
class OutfitMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(msg: RemoteMessage) {
    try {
      val d = msg.data
      val title = d["title"] ?: msg.notification?.title ?: return
      val body = d["body"] ?: msg.notification?.body ?: ""
      val circleId = d["circleId"] ?: ""
      val messageId = d["messageId"] ?: ""
      if (Build.VERSION.SDK_INT >= 33 &&
        ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
      ) return
      OutfitNotifier.ensureChannels(this)
      val link = if (circleId.isNotEmpty()) "outfit://circle/$circleId/$messageId" else null
      val open = Intent(this, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        if (link != null) data = Uri.parse(link)
        if (link != null) putExtra(EXTRA_LINK, link)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      }
      val id = (messageId.ifEmpty { System.currentTimeMillis().toString() }).hashCode()
      val pi = PendingIntent.getActivity(this, id, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val n = NotificationCompat.Builder(this, OutfitNotifier.CHANNEL_ACTIVITY)
        .setSmallIcon(R.drawable.ic_stat_outfit)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(pi)
        .build()
      NotificationManagerCompat.from(this).notify(id, n)
    } catch (_: Throwable) {
    }
  }

  override fun onNewToken(token: String) {
    // The app saves the current token at every start (src/native/push.ts); nothing to do here
  }

  companion object {
    const val EXTRA_LINK = "outfit_link"
  }
}

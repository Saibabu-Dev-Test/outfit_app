package com.outfit

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// Push (FCM). In the background, Android shows "notification" messages by itself on the activity
// channel and a tap opens MainActivity with the data as extras (outfit_payload -> coin flips).
// With the app open, this posts the same notification itself. The token is read by the app
// (NotificationsModule.getPushToken) and saved to Firestore, so onNewToken needs no work here
// beyond being safe; the app re-saves the token on every start.
class OutfitMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    try {
      val n = message.notification
      val title = n?.title ?: message.data["title"] ?: return
      val body = n?.body ?: message.data["body"] ?: ""
      val payload = message.data[OutfitNotifier.EXTRA_PAYLOAD]
      val id = 9000 + ((System.currentTimeMillis() / 1000L) % 100000L).toInt()
      OutfitNotifier.post(applicationContext, OutfitNotifier.CHANNEL_ACTIVITY, id, title, body, payload)
    } catch (_: Throwable) {}
  }

  override fun onNewToken(token: String) {
    // Saved by the app on its next start (src/services/pushApi.ts)
  }
}

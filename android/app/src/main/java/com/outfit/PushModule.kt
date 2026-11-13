package com.outfit

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

// FCM registration token for circle-poll push notifications (src/native/push.ts saves it to
// fcmTokens/{uid}; a GitHub Actions job sends the pushes). Guarded: no Firebase / Play services
// -> rejects, the app keeps working with in-app notifications only.
class PushModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitPush"

  @ReactMethod
  fun getToken(promise: Promise) {
    try {
      if (FirebaseApp.getApps(reactApplicationContext).isEmpty()) {
        FirebaseApp.initializeApp(reactApplicationContext)
      }
      if (FirebaseApp.getApps(reactApplicationContext).isEmpty()) {
        promise.reject("NO_FIREBASE", "Firebase not configured")
        return
      }
      FirebaseMessaging.getInstance().token
        .addOnSuccessListener { t -> promise.resolve(t) }
        .addOnFailureListener { e -> promise.reject("TOKEN_FAILED", e.message ?: "No token", e) }
    } catch (t: Throwable) {
      promise.reject("PUSH_ERROR", t.message ?: "Push unavailable", t)
    }
  }

  // Deep link of the notification that opened the app (outfit://circle/...), once
  @ReactMethod
  fun getInitialLink(promise: Promise) {
    try {
      val i = reactApplicationContext.currentActivity?.intent
      val link = i?.getStringExtra(OutfitMessagingService.EXTRA_LINK)
      if (link != null) i.removeExtra(OutfitMessagingService.EXTRA_LINK)
      promise.resolve(link)
    } catch (t: Throwable) {
      promise.resolve(null)
    }
  }
}

package com.outfit

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest
import com.google.android.gms.auth.api.identity.Identity

// Google Phone Number Hint: shows the SIM number(s) on this phone. Free, no SMS.
class PhoneHintModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  private var pending: Promise? = null

  private val listener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_CODE) return
      val p = pending ?: return
      pending = null
      if (resultCode != Activity.RESULT_OK || data == null) {
        p.reject("CANCELLED", "Phone number picker was closed")
        return
      }
      try {
        val number = Identity.getSignInClient(activity).getPhoneNumberFromIntent(data)
        if (number.isNullOrBlank()) p.reject("NO_NUMBER", "No phone number returned")
        else p.resolve(number)
      } catch (e: Exception) {
        p.reject("NO_NUMBER", e.message ?: "No phone number returned", e)
      }
    }
  }

  init {
    ctx.addActivityEventListener(listener)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun requestPhoneNumber(promise: Promise) {
    val activity = ctx.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "App is not in the foreground")
      return
    }
    if (pending != null) {
      promise.reject("IN_PROGRESS", "Phone number picker is already open")
      return
    }
    pending = promise
    val request = GetPhoneNumberHintIntentRequest.builder().build()
    Identity.getSignInClient(activity)
      .getPhoneNumberHintIntent(request)
      .addOnSuccessListener { pendingIntent ->
        try {
          activity.startIntentSenderForResult(pendingIntent.intentSender, REQUEST_CODE, null, 0, 0, 0)
        } catch (e: Exception) {
          pending?.reject("NO_HINT", e.message ?: "Could not open phone number picker", e)
          pending = null
        }
      }
      .addOnFailureListener { e ->
        // Usually: no SIM / no phone number on this device
        pending?.reject("NO_HINT", e.message ?: "No phone number found on this device", e)
        pending = null
      }
  }

  companion object {
    const val NAME = "OutfitPhoneHint"
    private const val REQUEST_CODE = 7311
  }
}

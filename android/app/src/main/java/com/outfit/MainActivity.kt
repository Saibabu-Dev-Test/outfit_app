package com.outfit

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "outfit"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  // react-native-screens: never let Android restore old screen fragments after the process was
  // killed in the background. Restoring them crashes with "Unable to instantiate fragment ...:
  // calling Fragment constructor caused an exception". React Navigation rebuilds the screens itself.
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    // Opened from a notification with a payload (e.g. like coins to flip): kept for the app
    OutfitNotifier.capturePayload(intent)
    // Last run crashed / was killed: show why in a native dialog before JavaScript starts, so the
    // tester sees it even if the app closes again a moment later (CrashModule.kt)
    CrashModule.showPendingCrash(this)
  }

  // Tapped a notification while the app was already open (singleTask)
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    OutfitNotifier.capturePayload(intent)
  }

  // App lock privacy: FLAG_SECURE on the lock screen, and no recents preview while the lock is on
  override fun onPause() {
    try { AppLockModule.applyPrivacy(this, true) } catch (_: Throwable) {}
    super.onPause()
  }

  override fun onResume() {
    super.onResume()
    try { AppLockModule.applyPrivacy(this, false) } catch (_: Throwable) {}
  }
}

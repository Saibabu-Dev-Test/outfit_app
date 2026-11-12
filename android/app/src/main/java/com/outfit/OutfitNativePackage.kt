package com.outfit

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// Registers the app's own native modules (works on the new arch through the interop layer)
class OutfitNativePackage : ReactPackage {
  @Deprecated("Legacy module registration; fine through new-arch interop")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    // Each module is created on its own: one that fails to construct is simply missing (the JS
    // side treats every one of them as optional) instead of taking the whole app down at start.
    val makers: List<() -> NativeModule> = listOf(
      { CrashModule(reactContext) },
      { PhoneHintModule(reactContext) },
      { AppLockModule(reactContext) },
      { NotificationsModule(reactContext) },
      { AppUpdateModule(reactContext) },
      { LocationModule(reactContext) },
      { ImageResizeModule(reactContext) },
      { TranslateModule(reactContext) },
      { CoinSoundModule(reactContext) },
    )
    return makers.mapNotNull { make ->
      try {
        make()
      } catch (t: Throwable) {
        android.util.Log.w("OutfitNativePackage", "native module skipped", t)
        null
      }
    }
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> =
    emptyList()
}

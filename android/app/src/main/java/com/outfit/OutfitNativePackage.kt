package com.outfit

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// Registers the app's own native modules (works on the new arch through the interop layer)
class OutfitNativePackage : ReactPackage {
  @Deprecated("Legacy module registration; fine through new-arch interop")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(PhoneHintModule(reactContext), AppLockModule(reactContext), NotificationsModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> =
    emptyList()
}

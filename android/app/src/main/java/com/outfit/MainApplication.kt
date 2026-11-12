package com.outfit

import android.app.Application
import android.content.Context
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(OutfitNativePackage())
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
      // Record React Native host errors (JS fatal reaching native) with their stack, then crash
      // exactly as before (the default handler rethrows)
      exceptionHandler = { e ->
        CrashModule.recordFatal(this, "React Native", e)
        throw e
      },
    )
  }

  // Earliest point in the process: the crash handler is in place before any library
  // ContentProvider (AdMob, WorkManager, ML Kit) initializes
  override fun attachBaseContext(base: Context) {
    super.attachBaseContext(base)
    CrashModule.install(this)
  }

  override fun onCreate() {
    // Already installed in attachBaseContext; re-wraps the handler if a provider replaced it
    CrashModule.install(this)
    super.onCreate()
    loadReactNative(this)
  }
}

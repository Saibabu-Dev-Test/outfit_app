package com.outfit

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

// Crash reporter for testers (no server): a native crash is written to files/last_crash.txt,
// then the default handler closes the app as usual. On the next launch index.js reads it with
// getLastCrash() and shows it in an Alert, so the tester can send a screenshot.
class CrashModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitCrash"

  @ReactMethod
  fun getLastCrash(promise: Promise) {
    try {
      val f = file(reactApplicationContext)
      if (!f.exists()) { promise.resolve(null); return }
      val text = f.readText()
      f.delete()
      promise.resolve(text)
    } catch (t: Throwable) {
      promise.resolve(null)
    }
  }

  companion object {
    private fun file(c: Context) = File(c.filesDir, "last_crash.txt")

    fun install(app: Context) {
      val previous = Thread.getDefaultUncaughtExceptionHandler()
      Thread.setDefaultUncaughtExceptionHandler { thread, error ->
        try {
          file(app).writeText("${error.javaClass.name}: ${error.message}\n" + error.stackTraceToString().take(3000))
        } catch (_: Throwable) {}
        previous?.uncaughtException(thread, error)
      }
    }
  }
}

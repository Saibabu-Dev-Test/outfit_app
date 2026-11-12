package com.outfit

import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.app.ApplicationExitInfo
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * Crash reporter for testers (no server) + start-up safe mode.
 *
 * What is captured (files/last_crash.txt, shown once on the next launch):
 *  - Java/Kotlin crashes: the default uncaught-exception handler below.
 *  - Native crashes (SIGSEGV/SIGABRT in a .so), ANRs, low-memory kills and other "the app just
 *    closed" exits: Android's ApplicationExitInfo (Android 11+), read at the next start.
 *  - Fatal JavaScript errors: saveJsCrash() from src/bootErrorHandler.js.
 *
 * How it is shown: MainActivity calls showPendingCrash() right after onCreate, which shows a NATIVE
 * dialog (with a Copy button) before JavaScript runs, so it is visible even when the app dies again
 * a second later. JavaScript can still read it with getLastCrash() (older code path).
 *
 * Safe mode: every start sets "boot pending"; JavaScript calls markBootOk() once the first screen
 * has been up for a few seconds. If the app died before that twice in a row, safe mode is switched
 * on for this app version (constant `safeMode`): JavaScript then skips the optional native features
 * (ads, coin sound, keyboard animation, coin flip overlay), so the app can still open. A new build
 * (higher versionCode) clears it.
 */
class CrashModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitCrash"

  override fun getConstants(): MutableMap<String, Any> =
    hashMapOf<String, Any>("safeMode" to safeMode, "nativeDialog" to true, "earlyDeaths" to earlyDeaths)

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

  // Fatal JS error text: kept for the next launch (the JS Alert may never get drawn)
  @ReactMethod
  fun saveJsCrash(text: String) {
    try {
      write(reactApplicationContext, "JavaScript error (build ${versionCode(reactApplicationContext)})\n" + text.take(MAX_TEXT))
    } catch (_: Throwable) {}
  }

  // The first screen has been up for a while: this start counts as good
  @ReactMethod
  fun markBootOk() {
    try {
      prefs(reactApplicationContext).edit().putBoolean(KEY_PENDING, false).putInt(KEY_DEATHS, 0).apply()
    } catch (_: Throwable) {}
  }

  @ReactMethod
  fun clearSafeMode() {
    try {
      prefs(reactApplicationContext).edit().remove(KEY_SAFE_VERSION).putInt(KEY_DEATHS, 0).apply()
    } catch (_: Throwable) {}
  }

  companion object {
    private const val PREFS = "outfit_crash"
    private const val KEY_PENDING = "boot_pending"
    private const val KEY_DEATHS = "early_deaths"
    private const val KEY_SAFE_VERSION = "safe_mode_version"
    private const val KEY_LAST_EXIT = "last_exit_ts"
    private const val MAX_TEXT = 3500

    @Volatile var safeMode = false
      private set
    @Volatile var earlyDeaths = 0
      private set

    private fun file(c: Context) = File(c.filesDir, "last_crash.txt")
    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    @Suppress("DEPRECATION")
    private fun versionCode(c: Context): Long =
      try {
        val pi = c.packageManager.getPackageInfo(c.packageName, 0)
        if (Build.VERSION.SDK_INT >= 28) pi.longVersionCode else pi.versionCode.toLong()
      } catch (_: Throwable) { 0L }

    private fun header(c: Context): String =
      "build ${versionCode(c)} · ${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"

    private fun write(c: Context, text: String) {
      try { file(c).writeText(text.take(MAX_TEXT + 400)) } catch (_: Throwable) {}
    }

    /** Called first thing in MainApplication.onCreate. Never throws. */
    fun install(app: Context) {
      try {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
          try {
            write(app, "Crash on thread ${thread.name}\n${header(app)}\n${error.javaClass.name}: ${error.message}\n" +
              error.stackTraceToString().take(MAX_TEXT))
            // remember we already have the text, so the exit-info reader does not overwrite it
            prefs(app).edit().putLong(KEY_LAST_EXIT, System.currentTimeMillis()).commit()
          } catch (_: Throwable) {}
          previous?.uncaughtException(thread, error)
        }
      } catch (_: Throwable) {}
      val abnormal = try { recordLastExit(app) } catch (_: Throwable) { null }
      try { updateBootState(app, abnormal) } catch (_: Throwable) {}
    }

    // Safe mode bookkeeping (see class comment)
    // abnormal: how the last run ended (Android 11+), null = unknown (older Android / no record)
    private fun updateBootState(app: Context, abnormal: Boolean?) {
      val p = prefs(app)
      val version = versionCode(app)
      var deaths = p.getInt(KEY_DEATHS, 0)
      // The last start never reached markBootOk(): it died early, unless Android says it was a
      // normal exit (the user swiped it away, an update, ...)
      deaths = if (p.getBoolean(KEY_PENDING, false) && abnormal != false) deaths + 1 else 0
      val e = p.edit().putBoolean(KEY_PENDING, true).putInt(KEY_DEATHS, deaths)
      if (deaths >= 2) e.putLong(KEY_SAFE_VERSION, version)
      e.apply()
      earlyDeaths = deaths
      safeMode = deaths >= 2 || p.getLong(KEY_SAFE_VERSION, -1L) == version
    }

    // Android 11+: why did the last run end? Native crash / ANR / low memory -> last_crash.txt
    @android.annotation.TargetApi(30)
    // Returns true = the last run ended abnormally, false = normally, null = unknown.
    private fun recordLastExit(app: Context): Boolean? {
      if (Build.VERSION.SDK_INT < 30) return null
      val am = app.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return null
      val info = am.getHistoricalProcessExitReasons(app.packageName, 0, 1).firstOrNull() ?: return null
      val p = prefs(app)
      val seen = p.getLong(KEY_LAST_EXIT, 0L)
      if (info.timestamp <= seen) return null
      p.edit().putLong(KEY_LAST_EXIT, info.timestamp).apply()
      // Low-memory / resource kills only matter while the app was on screen (realme and other
      // phones kill background apps all the time; that is not a crash)
      val foreground = info.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE
      val reason = when (info.reason) {
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "Native crash (signal ${info.status})"
        ApplicationExitInfo.REASON_ANR -> "App not responding (ANR)"
        ApplicationExitInfo.REASON_LOW_MEMORY -> if (foreground) "Killed: low memory (on screen)" else return false
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> if (foreground) "Killed: excessive resource use" else return false
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "Initialization failure"
        ApplicationExitInfo.REASON_CRASH -> "Crash"
        else -> return false // normal exits, user swipe, update, etc.
      }
      // Java crashes already wrote their own (better) text
      if (info.reason == ApplicationExitInfo.REASON_CRASH && file(app).exists()) return true
      val sb = StringBuilder()
      sb.append(reason).append('\n').append(header(app)).append('\n')
      info.description?.let { sb.append(it.take(400)).append('\n') }
      sb.append("pss ${info.pss / 1024} MB, rss ${info.rss / 1024} MB, at ")
        .append(java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date(info.timestamp)))
        .append('\n')
      if (info.reason == ApplicationExitInfo.REASON_CRASH_NATIVE || info.reason == ApplicationExitInfo.REASON_ANR) {
        try {
          info.traceInputStream?.use { s ->
            val bytes = s.readBytes()
            sb.append(readableTrace(bytes, info.reason == ApplicationExitInfo.REASON_ANR))
          }
        } catch (_: Throwable) {}
      }
      write(app, sb.toString())
      return true
    }

    // ANR traces are text (keep the "main" thread part); native tombstones are protobuf: keep the
    // readable strings (abort message, function names, library names), which is what we need.
    private fun readableTrace(bytes: ByteArray, text: Boolean): String {
      if (text) {
        val s = String(bytes, Charsets.UTF_8)
        val i = s.indexOf("\"main\"")
        return (if (i >= 0) s.substring(i) else s).take(MAX_TEXT)
      }
      val out = StringBuilder()
      val cur = StringBuilder()
      val seen = HashSet<String>()
      for (b in bytes) {
        val ch = b.toInt() and 0xFF
        if (ch in 0x20..0x7E) {
          cur.append(ch.toChar())
        } else {
          if (cur.length >= 6) {
            val str = cur.toString()
            if (seen.add(str)) out.append(str).append('\n')
          }
          cur.setLength(0)
        }
        if (out.length > MAX_TEXT) break
      }
      return out.toString().take(MAX_TEXT)
    }

    /** MainActivity.onCreate: show the last crash in a native dialog (before JS). Never throws. */
    fun showPendingCrash(activity: Activity) {
      try {
        val f = file(activity)
        if (!f.exists()) return
        val text = f.readText()
        f.delete()
        if (text.isBlank()) return
        AlertDialog.Builder(activity)
          .setTitle("Outfit closed last time (send this screenshot)")
          .setMessage(text.take(1800))
          .setPositiveButton("OK", null)
          .setNeutralButton("Copy") { _, _ ->
            try {
              val cm = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
              cm.setPrimaryClip(ClipData.newPlainText("Outfit crash", text))
            } catch (_: Throwable) {}
          }
          .show()
      } catch (_: Throwable) {}
    }
  }
}

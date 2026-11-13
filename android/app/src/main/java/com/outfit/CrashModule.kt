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
 *  - Java/Kotlin crashes: the default uncaught-exception handler, installed in
 *    MainApplication.attachBaseContext (before any library ContentProvider runs) and re-wrapped if
 *    a library replaces it later. Records exception class, message, top 15 stack lines + causes.
 *  - React Native host errors (JavascriptException etc.): recordFatal() from MainApplication.
 *  - Fatal JavaScript errors: saveJsCrash() from src/bootErrorHandler.js (ErrorUtils handler).
 *  - Native crashes (SIGSEGV/SIGABRT in a .so), ANRs, low-memory kills and Java crashes that
 *    happened before the handler ran: Android's ApplicationExitInfo (Android 11+), read at the next
 *    start (reason, description, status, process, and the native/ANR trace).
 *
 * Only crashes of THIS build are shown: every record carries the versionCode ("#build=N" first
 * line, and the process state summary for ApplicationExitInfo); exits from before the last
 * install/update and records of another build are dropped silently.
 *
 * How it is shown: MainActivity calls showPendingCrash() right after onCreate (native dialog with
 * Copy, before JavaScript runs). JavaScript can still read it with getLastCrash() (older path).
 *
 * Safe mode: every start sets "boot pending"; JavaScript calls markBootOk() once the first screen
 * has been up for a few seconds. If the app died before that twice in a row, safe mode is switched
 * on for this app version (constant `safeMode`). A new build (higher versionCode) clears it.
 */
class CrashModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitCrash"

  override fun getConstants(): MutableMap<String, Any> =
    hashMapOf<String, Any>("safeMode" to safeMode, "nativeDialog" to true, "earlyDeaths" to earlyDeaths)

  @ReactMethod
  fun getLastCrash(promise: Promise) {
    try {
      promise.resolve(takePending(reactApplicationContext))
    } catch (t: Throwable) {
      promise.resolve(null)
    }
  }

  // Fatal JS error text (already "Name: message" + top stack lines): kept for the next launch
  @ReactMethod
  fun saveJsCrash(text: String) {
    try {
      val c = reactApplicationContext
      write(c, "JavaScript fatal error\n${header(c)}\n${text.take(MAX_TEXT)}")
      prefs(c).edit().putLong(KEY_JS_TS, System.currentTimeMillis()).commit()
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
    private const val KEY_JS_TS = "js_crash_ts"
    private const val MAX_TEXT = 3500
    private const val STACK_LINES = 15
    private const val BUILD_TAG = "#build="

    @Volatile var safeMode = false
      private set
    @Volatile var earlyDeaths = 0
      private set
    @Volatile private var handler: Thread.UncaughtExceptionHandler? = null
    @Volatile private var installed = false

    private fun file(c: Context) = File(c.filesDir, "last_crash.txt")
    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    @Suppress("DEPRECATION")
    private fun versionCode(c: Context): Long =
      try {
        val pi = c.packageManager.getPackageInfo(c.packageName, 0)
        if (Build.VERSION.SDK_INT >= 28) pi.longVersionCode else pi.versionCode.toLong()
      } catch (_: Throwable) { 0L }

    // When this build was installed / updated (exits before that belong to an older build)
    private fun installedAt(c: Context): Long =
      try { c.packageManager.getPackageInfo(c.packageName, 0).lastUpdateTime } catch (_: Throwable) { 0L }

    private fun header(c: Context): String =
      "build ${versionCode(c)} · ${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"

    private fun now(ts: Long = System.currentTimeMillis()): String =
      java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date(ts))

    // Every record starts with "#build=<versionCode>" so another build's record is never shown
    private fun write(c: Context, text: String) {
      try { file(c).writeText("$BUILD_TAG${versionCode(c)}\n" + text.take(MAX_TEXT + 600)) } catch (_: Throwable) {}
    }

    /** Readable exception: class, message, top 15 frames, then each cause (top 5 frames). */
    fun describe(error: Throwable): String {
      val sb = StringBuilder()
      var t: Throwable? = error
      var depth = 0
      val seen = HashSet<Throwable>()
      while (t != null && depth < 4 && seen.add(t)) {
        if (depth > 0) sb.append("Caused by: ")
        sb.append(t.javaClass.name).append(": ").append(t.message ?: "(no message)").append('\n')
        val frames = t.stackTrace
        val limit = if (depth == 0) STACK_LINES else 5
        frames.take(limit).forEach { sb.append("  at ").append(it.toString()).append('\n') }
        if (frames.size > limit) sb.append("  ... ${frames.size - limit} more\n")
        t = t.cause
        depth++
      }
      return sb.toString()
    }

    private fun recordJava(app: Context, thread: Thread, error: Throwable) {
      write(app, "Java crash on thread \"${thread.name}\" at ${now()}\n${header(app)}\n${describe(error)}")
      // the exit-info reader must not overwrite this (better) text
      prefs(app).edit().putLong(KEY_LAST_EXIT, System.currentTimeMillis()).commit()
    }

    /**
     * React Native host error (MainApplication passes it in before rethrowing). JavaScript's own
     * handler usually saved a better text a moment earlier; that one is kept.
     */
    fun recordFatal(app: Context, source: String, error: Throwable) {
      try {
        val js = prefs(app).getLong(KEY_JS_TS, 0L)
        if (System.currentTimeMillis() - js < 10_000 && file(app).exists()) return
        write(app, "$source error at ${now()}\n${header(app)}\n${describe(error)}")
      } catch (_: Throwable) {}
    }

    /** Installs (or re-wraps, if a library replaced it) the uncaught-exception handler. Never throws. */
    fun ensureHandler(app: Context) {
      try {
        val current = Thread.getDefaultUncaughtExceptionHandler()
        if (current != null && current === handler) return
        val h = Thread.UncaughtExceptionHandler { thread, error ->
          try { recordJava(app, thread, error) } catch (_: Throwable) {}
          if (current != null) current.uncaughtException(thread, error)
          else { android.os.Process.killProcess(android.os.Process.myPid()); System.exit(10) }
        }
        handler = h
        Thread.setDefaultUncaughtExceptionHandler(h)
      } catch (_: Throwable) {}
    }

    /** MainApplication.attachBaseContext (earliest point). Safe to call twice. Never throws. */
    fun install(app: Context) {
      ensureHandler(app)
      if (installed) return
      installed = true
      // Tag this process with the build, so its ApplicationExitInfo can be matched to it later
      if (Build.VERSION.SDK_INT >= 30) {
        try {
          (app.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager)
            ?.setProcessStateSummary("$BUILD_TAG${versionCode(app)}".toByteArray())
        } catch (_: Throwable) {}
      }
      // Drop a record left by another build (e.g. written by the build before an update)
      try { if (pendingBuild(app) != versionCode(app)) file(app).delete() } catch (_: Throwable) {}
      val abnormal = try { recordLastExit(app) } catch (_: Throwable) { null }
      try { updateBootState(app, abnormal) } catch (_: Throwable) {}
    }

    // Safe mode bookkeeping (see class comment)
    // abnormal: how the last run ended (Android 11+), null = unknown (older Android / no record)
    private fun updateBootState(app: Context, abnormal: Boolean?) {
      val p = prefs(app)
      val version = versionCode(app)
      var deaths = p.getInt(KEY_DEATHS, 0)
      deaths = if (p.getBoolean(KEY_PENDING, false) && abnormal != false) deaths + 1 else 0
      val e = p.edit().putBoolean(KEY_PENDING, true).putInt(KEY_DEATHS, deaths)
      if (deaths >= 2) e.putLong(KEY_SAFE_VERSION, version)
      e.apply()
      earlyDeaths = deaths
      safeMode = deaths >= 2 || p.getLong(KEY_SAFE_VERSION, -1L) == version
    }

    private fun reasonName(r: Int): String = when (r) {
      ApplicationExitInfo.REASON_CRASH -> "CRASH"
      ApplicationExitInfo.REASON_CRASH_NATIVE -> "CRASH_NATIVE"
      ApplicationExitInfo.REASON_ANR -> "ANR"
      ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
      ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE_USAGE"
      ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INITIALIZATION_FAILURE"
      else -> "reason $r"
    }

    // Android 11+: why did the last run of THIS build end? Crash / native crash / ANR / low memory
    // -> last_crash.txt. Returns true = abnormal, false = normal, null = unknown.
    @android.annotation.TargetApi(30)
    private fun recordLastExit(app: Context): Boolean? {
      if (Build.VERSION.SDK_INT < 30) return null
      val am = app.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return null
      val p = prefs(app)
      val seen = p.getLong(KEY_LAST_EXIT, 0L)
      val since = maxOf(seen, installedAt(app))
      val myTag = "$BUILD_TAG${versionCode(app)}"
      // newest first; only exits after this build was installed, and tagged with this build
      val infos = am.getHistoricalProcessExitReasons(app.packageName, 0, 5).filter { i ->
        i.timestamp > since && (i.processStateSummary?.let { String(it) == myTag } ?: true)
      }
      val newest = infos.maxOfOrNull { it.timestamp } ?: return null
      p.edit().putLong(KEY_LAST_EXIT, maxOf(newest, seen)).apply()
      // Low-memory / resource kills only matter while the app was on screen (realme and other
      // phones kill background apps all the time; that is not a crash)
      val info = infos.sortedByDescending { it.timestamp }.firstOrNull { i ->
        val fg = i.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE
        when (i.reason) {
          ApplicationExitInfo.REASON_CRASH, ApplicationExitInfo.REASON_CRASH_NATIVE,
          ApplicationExitInfo.REASON_ANR, ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> true
          ApplicationExitInfo.REASON_LOW_MEMORY, ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> fg
          else -> false
        }
      } ?: return false
      val title = when (info.reason) {
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "Native crash (signal ${info.status})"
        ApplicationExitInfo.REASON_ANR -> "App not responding (ANR)"
        ApplicationExitInfo.REASON_LOW_MEMORY -> "Killed: low memory (on screen)"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "Killed: excessive resource use"
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "Initialization failure"
        else -> "Java crash"
      }
      // Java crashes already wrote their own text with the stack (this build only)
      if (info.reason == ApplicationExitInfo.REASON_CRASH && pendingBuild(app) == versionCode(app)) return true
      val sb = StringBuilder()
      sb.append(title).append(" at ").append(now(info.timestamp)).append('\n').append(header(app)).append('\n')
      sb.append("reason ").append(reasonName(info.reason)).append(", status ").append(info.status)
        .append(", process ").append(info.processName ?: "?").append('\n')
      info.description?.takeIf { it.isNotBlank() }?.let { sb.append("description: ").append(it.take(600)).append('\n') }
      if (info.pss > 0 || info.rss > 0) sb.append("pss ${info.pss / 1024} MB, rss ${info.rss / 1024} MB\n")
      var trace = ""
      try {
        info.traceInputStream?.use { s ->
          trace = readableTrace(s.readBytes(), info.reason == ApplicationExitInfo.REASON_ANR)
        }
      } catch (_: Throwable) {}
      if (trace.isNotBlank()) sb.append(trace)
      else if (info.reason == ApplicationExitInfo.REASON_CRASH)
        sb.append("(Android kept no Java stack: the app died before its crash handler ran.)\n")
      write(app, sb.toString())
      return true
    }

    // ANR traces are text (keep the "main" thread part); native tombstones are protobuf: keep the
    // readable strings (abort message, function names, library names), which is what we need.
    private fun readableTrace(bytes: ByteArray, text: Boolean): String {
      if (text) {
        val s = String(bytes, Charsets.UTF_8)
        val i = s.indexOf("\"main\"")
        val part = if (i >= 0) s.substring(i) else s
        return part.lineSequence().take(40).joinToString("\n").take(MAX_TEXT)
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

    // versionCode a pending record was written by, -1 = none / unknown (old format)
    private fun pendingBuild(c: Context): Long {
      val f = file(c)
      if (!f.exists()) return -1L
      val first = try { f.bufferedReader().use { it.readLine() } } catch (_: Throwable) { null } ?: return -1L
      return if (first.startsWith(BUILD_TAG)) first.removePrefix(BUILD_TAG).trim().toLongOrNull() ?: -1L else -1L
    }

    /** Reads + deletes the pending record; null when none or it belongs to another build. */
    private fun takePending(c: Context): String? {
      val f = file(c)
      if (!f.exists()) return null
      val build = pendingBuild(c)
      val text = try { f.readText() } catch (_: Throwable) { "" }
      f.delete()
      if (build != versionCode(c)) return null
      val body = text.substringAfter('\n', "").trim()
      return body.ifBlank { null }
    }

    /** MainActivity.onCreate: show the last crash of this build in a native dialog (before JS). Never throws. */
    fun showPendingCrash(activity: Activity) {
      try {
        ensureHandler(activity.applicationContext)
        val text = takePending(activity) ?: return
        AlertDialog.Builder(activity)
          .setTitle("Outfit closed last time (tap Copy and send it)")
          .setMessage(text.take(3000))
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

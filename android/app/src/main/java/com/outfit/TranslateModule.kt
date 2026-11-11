package com.outfit

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.languageid.LanguageIdentificationOptions
import com.google.mlkit.nl.languageid.LanguageIdentifier
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions

// Offline translation of other users' posts / comments / chat (Google ML Kit, on the phone).
// Free, no server, no Firebase: Language ID ships inside the APK; each translation language
// model (~30 MB) is downloaded once by Google Play services / ML Kit and then works offline.
// translate() never downloads by itself: when a model is missing it rejects "NO_MODEL" and the
// app shows the original text (src/services/translate.ts decides when ensureModel() runs).
class TranslateModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  // Lazy + guarded: nothing ML Kit runs at app start, so a missing / broken ML Kit can never crash launch
  private val models: RemoteModelManager? by lazy { try { RemoteModelManager.getInstance() } catch (t: Throwable) { null } }
  private val translators = HashMap<String, Translator>() // "te|hi" -> open translator
  private var identifier: LanguageIdentifier? = null

  override fun getName(): String = NAME

  private fun langId(): LanguageIdentifier =
    identifier ?: LanguageIdentification.getClient(
      LanguageIdentificationOptions.Builder().setConfidenceThreshold(0.5f).build()
    ).also { identifier = it }

  // BCP-47 code ("te", "hi-Latn" ...) or "und" when unsure
  @ReactMethod
  fun identify(text: String, promise: Promise) {
    try {
      if (text.isBlank()) {
        promise.resolve("und")
        return
      }
      langId().identifyLanguage(text)
        .addOnSuccessListener { code -> promise.resolve(code ?: "und") }
        .addOnFailureListener { e -> promise.reject("IDENTIFY_FAILED", e.message ?: "Could not identify language", e) }
    } catch (t: Throwable) {
      promise.reject("MLKIT_ERROR", t.message ?: "ML Kit unavailable", t)
    }
  }

  // Translates with models already on the phone. Rejects UNSUPPORTED / NO_MODEL / TRANSLATE_FAILED.
  @ReactMethod
  fun translate(text: String, from: String, to: String, promise: Promise) {
    try {
      val src = TranslateLanguage.fromLanguageTag(from)
      val tgt = TranslateLanguage.fromLanguageTag(to)
      if (src == null || tgt == null) {
        promise.reject("UNSUPPORTED", "Translation not supported: $from -> $to")
        return
      }
      if (src == tgt || text.isBlank()) {
        promise.resolve(text)
        return
      }
      val mm = models ?: run { promise.reject("NO_MODEL", "ML Kit unavailable"); return }
      val srcModel = TranslateRemoteModel.Builder(src).build()
      val tgtModel = TranslateRemoteModel.Builder(tgt).build()
      Tasks.whenAllSuccess<Boolean>(mm.isModelDownloaded(srcModel), mm.isModelDownloaded(tgtModel))
        .addOnSuccessListener { ready ->
          if (ready.any { it != true }) {
            promise.reject("NO_MODEL", "Language model not downloaded: $from -> $to")
            return@addOnSuccessListener
          }
          val key = "$src|$tgt"
          val translator = synchronized(translators) {
            translators.getOrPut(key) {
              Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(src).setTargetLanguage(tgt).build())
            }
          }
          translator.translate(text)
            .addOnSuccessListener { out -> promise.resolve(out) }
            .addOnFailureListener { e -> promise.reject("TRANSLATE_FAILED", e.message ?: "Translation failed", e) }
        }
        .addOnFailureListener { e -> promise.reject("NO_MODEL", e.message ?: "Could not check language model", e) }
    } catch (t: Throwable) {
      promise.reject("MLKIT_ERROR", t.message ?: "ML Kit unavailable", t)
    }
  }

  // Downloads a language model if missing (no-op when present). Resolves true when ready.
  @ReactMethod
  fun ensureModel(lang: String, wifiOnly: Boolean, promise: Promise) {
    try {
      val code = TranslateLanguage.fromLanguageTag(lang)
      if (code == null) {
        promise.reject("UNSUPPORTED", "No translation model for $lang")
        return
      }
      val conditions = if (wifiOnly) DownloadConditions.Builder().requireWifi().build() else DownloadConditions.Builder().build()
      val mm = models ?: run { promise.reject("DOWNLOAD_FAILED", "ML Kit unavailable"); return }
      mm.download(TranslateRemoteModel.Builder(code).build(), conditions)
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { e -> promise.reject("DOWNLOAD_FAILED", e.message ?: "Model download failed", e) }
    } catch (t: Throwable) {
      promise.reject("MLKIT_ERROR", t.message ?: "ML Kit unavailable", t)
    }
  }

  // True when the model is already on the phone (never downloads)
  @ReactMethod
  fun hasModel(lang: String, promise: Promise) {
    try {
      val code = TranslateLanguage.fromLanguageTag(lang)
      if (code == null) {
        promise.resolve(false)
        return
      }
      val mm = models ?: run { promise.resolve(false); return }
      mm.isModelDownloaded(TranslateRemoteModel.Builder(code).build())
        .addOnSuccessListener { ok -> promise.resolve(ok == true) }
        .addOnFailureListener { promise.resolve(false) }
    } catch (t: Throwable) {
      promise.reject("MLKIT_ERROR", t.message ?: "ML Kit unavailable", t)
    }
  }

  override fun invalidate() {
    try { synchronized(translators) {
      translators.values.forEach { it.close() }
      translators.clear()
    }
    identifier?.close()
    identifier = null
    } catch (_: Throwable) {}
    super.invalidate()
  }

  companion object {
    const val NAME = "OutfitTranslate"
  }
}

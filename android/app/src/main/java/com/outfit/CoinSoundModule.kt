package com.outfit

import android.media.AudioAttributes
import android.media.SoundPool
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Coin sound (res/raw/coin_flip.ogg, synthesized in-house by scripts/sounds/synth_coin_flip.py,
// no license): one soft, smooth coin "ting" (0.6 s): partials ~1.25/1.88/2.46 kHz, ~5 ms soft attack,
// smooth exponential decay, gentle low-pass. Mono 44.1 kHz vorbis,
// peak -6 dBFS. SoundPool loads it once; play() is fire-and-forget on the MEDIA stream (USAGE_MEDIA ->
// STREAM_MUSIC), so it follows the phone's media volume. The app never changes the system volume.
// playAt(volume) takes the in-app volume (Settings > Coin sound slider) as the SoundPool stream volume,
// hard-capped at MAX_VOLUME (40% of media volume). Never throws to JS.
class CoinSoundModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitCoinSound"

  companion object {
    const val MAX_VOLUME = 0.4f // the coin ting is never louder than 40% of the phone media volume
  }

  private var pool: SoundPool? = null
  private var soundId = 0
  @Volatile private var loaded = false
  // A play asked for before the sound finished loading (first coin of the session): played on load
  @Volatile private var pendingVolume = -1f

  // Lazy: the SoundPool is made on the first play(), never at app start (and never in safe mode)
  @Synchronized
  private fun ensurePool(): SoundPool? {
    pool?.let { return it }
    if (CrashModule.safeMode) return null
    try {
      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build()
      val p = SoundPool.Builder().setMaxStreams(4).setAudioAttributes(attrs).build()
      p.setOnLoadCompleteListener { sp, _, status ->
        loaded = status == 0
        val v = pendingVolume
        pendingVolume = -1f
        if (loaded && v > 0f) {
          try { sp.play(soundId, v, v, 1, 0, 1f) } catch (_: Throwable) {}
        }
      }
      soundId = p.load(reactApplicationContext, R.raw.coin_flip, 1)
      pool = p
    } catch (_: Throwable) {
      pool = null
    }
    return pool
  }

  // Optional warm-up (loads the sound so the first flip is not silent). Never throws.
  @ReactMethod
  fun preload() {
    try { ensurePool() } catch (_: Throwable) {}
  }

  @ReactMethod
  fun play() {
    playAt(MAX_VOLUME.toDouble())
  }

  // volume 0..0.4 (in-app setting, default 0.4 = the cap); the phone's media volume still applies on top
  @ReactMethod
  fun playAt(volume: Double) {
    try {
      val p = ensurePool() ?: return
      val v = volume.toFloat().coerceIn(0f, MAX_VOLUME)
      if (v <= 0f) return
      if (loaded) p.play(soundId, v, v, 1, 0, 1f) else pendingVolume = v
    } catch (_: Throwable) {}
  }

  override fun invalidate() {
    try {
      pool?.release()
    } catch (_: Throwable) {}
    pool = null
    loaded = false
    super.invalidate()
  }
}

package com.outfit

import android.media.AudioAttributes
import android.media.SoundPool
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Coin spin sound (res/raw/coin_flip.ogg, synthesized in-house by scripts/sounds/synth_coin_flip.py,
// no license): a 1.5 s metallic coin spin. A bright flick "ting", the coin spinning on its edge
// (wobble speeding up 8 -> 40 Hz), a settle ting at ~1.05 s that lands with the flip
// (CoinFlipProvider / CoinRain FLIP_MS 1500), then a smooth raised-cosine fade to silence at 1.5 s.
// Mono 44.1 kHz vorbis, about -3 LUFS, peak <= -1 dBFS (loud, no clipping). SoundPool loads it once;
// play() is fire-and-forget on the MEDIA stream (USAGE_MEDIA -> STREAM_MUSIC), so it follows the
// phone's media volume. The app never changes the system volume. playAt(volume) takes the in-app
// volume (0..1, Settings > Coin sound slider) as the SoundPool stream volume. Never throws to JS.
class CoinSoundModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitCoinSound"

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
    playAt(1.0)
  }

  // volume 0..1 (in-app setting, default 1.0 = full); the phone's media volume still applies on top
  @ReactMethod
  fun playAt(volume: Double) {
    try {
      val p = ensurePool() ?: return
      val v = volume.toFloat().coerceIn(0f, 1f)
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

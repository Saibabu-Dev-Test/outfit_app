package com.outfit

import android.media.AudioAttributes
import android.media.SoundPool
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Small-coin jingle (res/raw/coin_flip.ogg, synthesized in-house, no license) played at the start of
// each coin flip: 1.8 s of bright 3-6 kHz clinks spacing out like a coin settling, then a settle ring
// that lands with the flip (CoinFlipProvider FLIP_MS 1400). Compressed + limited to about -1 dBTP peak,
// slowed to 4 s (slow motion, deeper) and about -4.7 LUFS (louder, no clipping). SoundPool loads it once; play() is fire-and-forget on the MEDIA stream
// (USAGE_MEDIA -> STREAM_MUSIC), so the phone's volume buttons / media volume control it.
// playAt(volume) takes the in-app volume (0..1, Settings > Coin sound). Never throws to JS.
class CoinSoundModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitCoinSound"

  private var pool: SoundPool? = null
  private var soundId = 0
  @Volatile private var loaded = false

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
      p.setOnLoadCompleteListener { _, _, status -> loaded = status == 0 }
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
      if (loaded && v > 0f) p.play(soundId, v, v, 1, 0, 1f)
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

package com.outfit

import android.media.AudioAttributes
import android.media.SoundPool
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Short coin "ding" (res/raw/coin_flip.ogg, generated in-house, no license) played at the start of
// each coin flip. SoundPool loads it once; play() is fire-and-forget on the media stream, so it
// follows the phone's media volume (silent when media volume is 0). Never throws to JS.
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
        .setUsage(AudioAttributes.USAGE_GAME)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
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
    try {
      val p = ensurePool() ?: return
      if (loaded) p.play(soundId, 0.5f, 0.5f, 1, 0, 1f)
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

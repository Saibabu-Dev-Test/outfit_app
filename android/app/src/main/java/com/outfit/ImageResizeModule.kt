package com.outfit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Shrinks a photo to a small, clean image for Firestore (no Cloud Storage on the free Spark plan).
 * resize(uri, maxEdge, maxBytes): uri is a content:// / file:// path from the image picker or a
 * data: URI. Steps: EXIF rotation -> filtered multi-step downscale (halving, then one bilinear
 * step) to maxEdge (never upscales) -> flatten on white -> slight auto-contrast -> mild unsharp
 * mask -> binary search of the quality (60..92) for the best quality that fits maxBytes. When even
 * quality 60 is too big the long edge is lowered (x0.85) instead of dropping the quality further.
 * Encoding is lossy WebP (Android's built-in encoder: WEBP_LOSSY on API 30+, WEBP below), which is
 * about 25-35% smaller than JPEG at the same look, so the same bytes buy a sharper photo. If the
 * WebP encoder fails on a device, JPEG is used.
 * resizeSharp(uri, maxEdge, maxBytes, sharpen) does the same with a chosen sharpen amount.
 * Resolves {base64, mime, width, height, bytes, quality}. Runs off the UI thread. If a big photo
 * runs out of memory it is retried once at 3/4 of the size.
 * Keep in sync with src/utils/imageResize.web.ts.
 */
class ImageResizeModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  private fun open(uri: String): InputStream {
    if (uri.startsWith("data:")) {
      val comma = uri.indexOf(',')
      return ByteArrayInputStream(Base64.decode(uri.substring(comma + 1), Base64.DEFAULT))
    }
    if (uri.startsWith("/")) return FileInputStream(File(uri))
    return ctx.contentResolver.openInputStream(Uri.parse(uri)) ?: throw IllegalArgumentException("Cannot open $uri")
  }

  private fun orientation(uri: String): Int =
    try {
      open(uri).use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
    } catch (e: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }

  private fun rotate(src: Bitmap, o: Int): Bitmap {
    val m = Matrix()
    when (o) {
      ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        m.postRotate(90f)
        m.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        m.postRotate(270f)
        m.postScale(-1f, 1f)
      }
      else -> return src
    }
    val out = Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
    if (out != src) src.recycle()
    return out
  }

  // Long edge <= edge. Halves with bilinear filtering while still >= 2x the target (no aliasing,
  // unlike one big nearest/bilinear jump), then one filtered step to the exact size, drawn on
  // white (JPEG has no transparency). Never upscales. Does not recycle src.
  private fun fit(src: Bitmap, edge: Int): Bitmap {
    val long = max(src.width, src.height)
    val scale = if (long > edge) edge.toFloat() / long else 1f
    val w = max(1, (src.width * scale).roundToInt())
    val h = max(1, (src.height * scale).roundToInt())
    var cur = src
    while (cur.width / 2 >= w * 2 && cur.height / 2 >= h * 2) {
      val half = Bitmap.createScaledBitmap(cur, max(1, cur.width / 2), max(1, cur.height / 2), true)
      if (cur != src) cur.recycle()
      cur = half
    }
    val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(out)
    c.drawColor(Color.WHITE)
    val p = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG or Paint.DITHER_FLAG)
    val scaled = if (cur.width == w && cur.height == h) cur else Bitmap.createScaledBitmap(cur, w, h, true)
    c.drawBitmap(scaled, 0f, 0f, p)
    if (scaled != src) scaled.recycle()
    if (cur != src && cur != scaled) cur.recycle()
    return out
  }

  /**
   * Slight auto-contrast + mild unsharp mask, in place on an ARGB_8888 bitmap.
   * Contrast: luminance 0.5% / 99.5% points are stretched toward 0 / 255, capped (black point
   * <= 24, white point >= 228) and blended 50% with the original so colours stay natural.
   * Sharpen: out = px + amount * (px - blur3x3(px)), skipped where the difference is below a small
   * threshold so flat areas / noise are not amplified (that would also bloat the JPEG).
   */
  private fun enhance(bmp: Bitmap, sharpen: Float = -1f) {
    val w = bmp.width
    val h = bmp.height
    val n = w * h
    if (n < 4) return
    val px = IntArray(n)
    bmp.getPixels(px, 0, w, 0, 0, w, h)

    // ── auto-contrast LUT ──
    val hist = IntArray(256)
    for (c in px) {
      val r = (c shr 16) and 0xFF
      val g = (c shr 8) and 0xFF
      val b = c and 0xFF
      hist[(r * 77 + g * 150 + b * 29) shr 8]++
    }
    val clip = n / 200
    var lo = 0
    var acc = 0
    while (lo < 255 && acc + hist[lo] <= clip) { acc += hist[lo]; lo++ }
    var hi = 255
    acc = 0
    while (hi > 0 && acc + hist[hi] <= clip) { acc += hist[hi]; hi-- }
    lo = min(lo, 24)
    hi = max(hi, 228)
    val lut = IntArray(256)
    val range = (hi - lo).coerceAtLeast(1).toFloat()
    for (v in 0 until 256) {
      val stretched = ((v - lo) * 255f / range).coerceIn(0f, 255f)
      lut[v] = ((v + stretched) * 0.5f).roundToInt().coerceIn(0, 255)
    }

    val rr = IntArray(n)
    val gg = IntArray(n)
    val bb = IntArray(n)
    for (i in 0 until n) {
      val c = px[i]
      rr[i] = lut[(c shr 16) and 0xFF]
      gg[i] = lut[(c shr 8) and 0xFF]
      bb[i] = lut[c and 0xFF]
    }

    // ── unsharp mask (separable 3x3 box blur), one channel at a time with shared buffers so a
    //    1600 px photo needs ~6 int arrays, not 10 ──
    val small = max(w, h) <= 400
    val amount = if (sharpen >= 0f) sharpen else if (small) 0.35f else 0.55f
    val threshold = 3
    val tmp = IntArray(n)
    val blurred = IntArray(n)
    for (ch in arrayOf(rr, gg, bb)) {
      blur3(ch, w, h, tmp, blurred)
      for (i in 0 until n) ch[i] = sharp(ch[i], blurred[i], amount, threshold)
    }
    for (i in 0 until n) px[i] = (0xFF shl 24) or (rr[i] shl 16) or (gg[i] shl 8) or bb[i]
    bmp.setPixels(px, 0, w, 0, 0, w, h)
  }

  private fun sharp(v: Int, blurred: Int, amount: Float, threshold: Int): Int {
    val d = v - blurred
    if (d > -threshold && d < threshold) return v
    return (v + amount * d).roundToInt().coerceIn(0, 255)
  }

  // 3x3 box blur into out (tmp = scratch of the same size), edges clamped
  private fun blur3(src: IntArray, w: Int, h: Int, tmp: IntArray, out: IntArray) {
    for (y in 0 until h) {
      val row = y * w
      for (x in 0 until w) {
        val l = src[row + max(0, x - 1)]
        val r = src[row + min(w - 1, x + 1)]
        tmp[row + x] = l + src[row + x] + r
      }
    }
    for (y in 0 until h) {
      val up = max(0, y - 1) * w
      val dn = min(h - 1, y + 1) * w
      val row = y * w
      for (x in 0 until w) out[row + x] = (tmp[up + x] + tmp[row + x] + tmp[dn + x] + 4) / 9
    }
  }

  @Suppress("DEPRECATION")
  private val webpFormat: Bitmap.CompressFormat =
    if (Build.VERSION.SDK_INT >= 30) Bitmap.CompressFormat.WEBP_LOSSY else Bitmap.CompressFormat.WEBP

  // Encoded bytes; useWebp is switched off for good if this device's WebP encoder fails
  private var useWebp = true
  private fun encode(bmp: Bitmap, q: Int): ByteArray {
    if (useWebp) {
      try {
        val bos = ByteArrayOutputStream()
        if (bmp.compress(webpFormat, q, bos) && bos.size() > 0) return bos.toByteArray()
      } catch (e: Throwable) {
        // fall through to JPEG
      }
      useWebp = false
    }
    val bos = ByteArrayOutputStream()
    bmp.compress(Bitmap.CompressFormat.JPEG, q, bos)
    return bos.toByteArray()
  }
  private fun mime(): String = if (useWebp) "image/webp" else "image/jpeg"

  @ReactMethod
  fun resize(uri: String, maxEdge: Int, maxBytes: Int, promise: Promise) {
    resizeSharp(uri, maxEdge, maxBytes, -1.0, promise)
  }

  // Same as resize with an explicit unsharp-mask amount (< 0 = default). The clear feed photo
  // (720 px, ~45 KB) uses a stronger amount so it stays crisp at full screen width.
  @ReactMethod
  fun resizeSharp(uri: String, maxEdge: Int, maxBytes: Int, sharpen: Double, promise: Promise) {
    val amount = sharpen.toFloat().coerceAtMost(1.5f)
    Thread {
      try {
        val map = try {
          work(uri, maxEdge, maxBytes, amount)
        } catch (oom: OutOfMemoryError) {
          // Very large photo on a small phone: once more at 3/4 of the size
          System.gc()
          work(uri, max(64, maxEdge * 3 / 4), maxBytes, amount)
        }
        promise.resolve(map)
      } catch (e: Throwable) {
        promise.reject("RESIZE_FAILED", e.message ?: "Could not read the photo", e)
      }
    }.start()
  }

  private fun work(uri: String, maxEdge: Int, maxBytes: Int, amount: Float): com.facebook.react.bridge.WritableMap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw IllegalArgumentException("Not an image")
    // Power-of-two subsampling while the decoded long edge stays >= 2x maxEdge (saves memory,
    // leaves the filtered downscale enough pixels to work with)
    var sample = 1
    val long = max(bounds.outWidth, bounds.outHeight)
    while (long / (sample * 2) >= maxEdge * 2) sample *= 2
    val opts = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    val decoded = open(uri).use { BitmapFactory.decodeStream(it, null, opts) }
      ?: throw IllegalArgumentException("Could not decode the photo")
    val upright = rotate(decoded, orientation(uri))
    // One filtered downscale to maxEdge (never larger than the original), then the big decode is
    // freed; smaller retries start from this copy.
    val base = fit(upright, maxEdge)
    if (base != upright) upright.recycle()

    var edge = max(base.width, base.height)
    var best: ByteArray? = null
    var bestMime = mime()
    var bw = 0
    var bh = 0
    var bq = 0
    for (round in 0 until 8) {
      val bmp = if (round == 0) base.copy(Bitmap.Config.ARGB_8888, true) else fit(base, edge)
      enhance(bmp, amount)
      // Highest quality in [MIN_Q, MAX_Q] that fits maxBytes
      var fitBytes: ByteArray? = null
      var fitMime = mime()
      var fitQ = 0
      var lowQ = MIN_Q
      var highQ = MAX_Q
      while (lowQ <= highQ) {
        val mid = (lowQ + highQ) / 2
        val b = encode(bmp, mid)
        if (b.size <= maxBytes) {
          fitBytes = b
          fitMime = mime()
          fitQ = mid
          lowQ = mid + 1
        } else {
          highQ = mid - 1
        }
      }
      bw = bmp.width
      bh = bmp.height
      if (fitBytes != null) {
        best = fitBytes
        bestMime = fitMime
        bq = fitQ
        bmp.recycle()
        break
      }
      // Too big even at MIN_Q: keep it as a last resort, then try a smaller size
      best = encode(bmp, MIN_Q)
      bestMime = mime()
      bq = MIN_Q
      bmp.recycle()
      if (edge <= 64) break
      edge = max(64, (edge * 0.85f).roundToInt())
    }
    base.recycle()
    val out = best ?: throw IllegalStateException("No output")
    val map = Arguments.createMap()
    map.putString("base64", Base64.encodeToString(out, Base64.NO_WRAP))
    map.putString("mime", bestMime)
    map.putInt("width", bw)
    map.putInt("height", bh)
    map.putInt("bytes", out.size)
    map.putInt("quality", bq)
    return map
  }

  companion object {
    const val NAME = "OutfitImageResize"
    private const val MIN_Q = 60
    private const val MAX_Q = 92
  }
}

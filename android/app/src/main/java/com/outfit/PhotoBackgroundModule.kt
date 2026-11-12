package com.outfit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Photo background for clothing photos, on the phone (ML Kit subject segmentation, no upload).
 * process(uri, mode):
 *   mode "plain": the background becomes one solid colour opposite to the clothes: black behind
 *                 light clothes, white behind dark / colourful ones (by the subject's average
 *                 brightness).
 *   mode "blur":  the background is strongly blurred, the clothes stay sharp.
 * Resolves {uri: "file://...jpg", changed: true} with a new JPEG (long edge <= 1600, EXIF rotation
 * applied), or {uri: <same uri>, changed: false} when no subject was found or segmentation is not
 * available (model still downloading, old Play services). Never rejects for those cases, so a photo
 * is always saved. Runs on its own thread.
 */
class PhotoBackgroundModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = "OutfitPhotoBackground"

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
      ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
      else -> return src
    }
    val out = Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
    if (out != src) src.recycle()
    return out
  }

  // Decoded, rotated, long edge <= edge, ARGB_8888
  private fun load(uri: String, edge: Int): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= edge) sample *= 2
    val opts = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }
    var bmp = open(uri).use { BitmapFactory.decodeStream(it, null, opts) } ?: throw IllegalArgumentException("Cannot decode")
    bmp = rotate(bmp, orientation(uri))
    val long = max(bmp.width, bmp.height)
    if (long > edge) {
      val s = edge.toFloat() / long
      val scaled = Bitmap.createScaledBitmap(bmp, max(1, (bmp.width * s).roundToInt()), max(1, (bmp.height * s).roundToInt()), true)
      if (scaled != bmp) bmp.recycle()
      bmp = scaled
    }
    if (bmp.config != Bitmap.Config.ARGB_8888) {
      val c = bmp.copy(Bitmap.Config.ARGB_8888, false)
      bmp.recycle()
      bmp = c
    }
    return bmp
  }

  // Strong, cheap blur: shrink to ~1/20, then scale back up in two filtered steps
  private fun blurred(src: Bitmap): Bitmap {
    val w = src.width
    val h = src.height
    val small = Bitmap.createScaledBitmap(src, max(1, w / 20), max(1, h / 20), true)
    val mid = Bitmap.createScaledBitmap(small, max(1, w / 5), max(1, h / 5), true)
    small.recycle()
    val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    Canvas(out).drawBitmap(Bitmap.createScaledBitmap(mid, w, h, true), 0f, 0f, Paint(Paint.FILTER_BITMAP_FLAG))
    mid.recycle()
    return out
  }

  @ReactMethod
  fun process(uri: String, mode: String, promise: Promise) {
    Thread {
      val unchanged = Arguments.createMap().apply { putString("uri", uri); putBoolean("changed", false) }
      try {
        val bmp = load(uri, 1600)
        val w = bmp.width
        val h = bmp.height
        val segmenter = SubjectSegmentation.getClient(
          SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build(),
        )
        val result = try {
          Tasks.await(segmenter.process(InputImage.fromBitmap(bmp, 0)), 30, TimeUnit.SECONDS)
        } finally {
          try { segmenter.close() } catch (_: Throwable) {}
        }
        val mask = result.foregroundConfidenceMask
        if (mask == null) {
          bmp.recycle(); promise.resolve(unchanged); return@Thread
        }
        mask.rewind()
        val n = w * h
        val px = IntArray(n)
        bmp.getPixels(px, 0, w, 0, 0, w, h)
        val alpha = FloatArray(n)
        var fgCount = 0
        var lumSum = 0.0
        var lumW = 0.0
        for (i in 0 until n) {
          // Soft edge: confidence 0.3..0.7 ramps 0..1
          val c = if (mask.hasRemaining()) mask.get() else 0f
          val a = min(1f, max(0f, (c - 0.3f) / 0.4f))
          alpha[i] = a
          if (a > 0.5f) {
            fgCount++
            val p = px[i]
            val lum = 0.299 * Color.red(p) + 0.587 * Color.green(p) + 0.114 * Color.blue(p)
            lumSum += lum * a
            lumW += a
          }
        }
        // No clear subject (or the whole photo is "subject"): keep the photo as it was
        if (fgCount < n * 0.02 || fgCount > n * 0.98) {
          bmp.recycle(); promise.resolve(unchanged); return@Thread
        }
        val bg = IntArray(n)
        if (mode == "blur") {
          val b = blurred(bmp)
          b.getPixels(bg, 0, w, 0, 0, w, h)
          b.recycle()
        } else {
          val avg = if (lumW > 0) lumSum / lumW else 128.0
          val solid = if (avg >= 140.0) Color.rgb(0, 0, 0) else Color.rgb(255, 255, 255)
          java.util.Arrays.fill(bg, solid)
        }
        for (i in 0 until n) {
          val a = alpha[i]
          if (a >= 1f) continue
          val f = px[i]
          val g = bg[i]
          val r = (Color.red(f) * a + Color.red(g) * (1 - a)).roundToInt()
          val gr = (Color.green(f) * a + Color.green(g) * (1 - a)).roundToInt()
          val bl = (Color.blue(f) * a + Color.blue(g) * (1 - a)).roundToInt()
          px[i] = Color.rgb(r, gr, bl)
        }
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        out.setPixels(px, 0, w, 0, 0, w, h)
        bmp.recycle()
        val dir = File(ctx.cacheDir, "photo-bg").apply { mkdirs() }
        // Old outputs from earlier picks are not needed once the photo was saved
        dir.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 6 * 3600_000L }?.forEach { it.delete() }
        val file = File(dir, "bg_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { out.compress(Bitmap.CompressFormat.JPEG, 95, it) }
        out.recycle()
        promise.resolve(Arguments.createMap().apply { putString("uri", "file://${file.absolutePath}"); putBoolean("changed", true) })
      } catch (t: Throwable) {
        // Model not downloaded yet, out of memory, unreadable photo: save the photo unchanged
        android.util.Log.w("OutfitPhotoBackground", "background skipped", t)
        promise.resolve(unchanged)
      }
    }.start()
  }
}

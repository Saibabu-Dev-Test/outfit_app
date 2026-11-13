package com.outfit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
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
import kotlin.math.roundToInt

/**
 * Photo background for clothing photos, on the phone (ML Kit subject segmentation, no upload).
 * process(uri, mode):
 *   mode "plain": the background becomes one solid colour opposite to the clothes: black behind
 *                 light clothes, white behind dark / colourful ones (by the subject's average
 *                 brightness).
 *   mode "blur":  the background is blurred (level 1..5) and slightly dimmed; the subject stays the
 *                 original sharp pixels.
 * The edge work (soft confidence mask refined against the photo's own colours, no subject
 * colours smeared into the blur, no old-background halo) is in SegmentMath.kt (JVM-tested).
 * Runs on the full-size photo BEFORE Blur face and the Adjust crop (utils/imagePicker remakeImage),
 * so zooming / cropping never cuts or blurs the person's outline.
 * Resolves {uri: "file://...jpg", changed: true} with a new JPEG (long edge <= 2048, EXIF rotation
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

  @ReactMethod
  fun process(uri: String, mode: String, promise: Promise) = runJob(uri, mode, 3, promise)

  // Blur strength 1..5 (ignored for "plain")
  @ReactMethod
  fun processLevel(uri: String, mode: String, level: Int, promise: Promise) = runJob(uri, mode, level.coerceIn(1, 5), promise)

  // Segmentation + background on one decoded photo (long edge <= edge). Null = keep the photo.
  private fun render(uri: String, mode: String, level: Int, edge: Int): Bitmap? {
    val bmp = load(uri, edge)
    try {
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
      // Raw confidence (0..1) for every pixel of this full-size photo (same size as the input)
      val mask = result.foregroundConfidenceMask ?: return null
      mask.rewind()
      val n = w * h
      if (mask.remaining() < n) return null
      val conf = FloatArray(n)
      mask.get(conf, 0, n)
      val px = IntArray(n)
      bmp.getPixels(px, 0, w, 0, 0, w, h)
      val out = SegmentMath.process(px, conf, w, h, if (mode == "blur") "blur" else "plain", level) ?: return null
      val res = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
      res.setPixels(out, 0, w, 0, 0, w, h)
      return res
    } finally {
      bmp.recycle()
    }
  }

  private fun runJob(uri: String, mode: String, level: Int, promise: Promise) {
    Thread {
      val unchanged = Arguments.createMap().apply { putString("uri", uri); putBoolean("changed", false) }
      try {
        // Full quality (2048 px, the size the photo is saved at) so the outline is cut at full
        // resolution and Adjust / zoom never shows an upscaled edge. A phone short on memory
        // gets a smaller (still clear) copy.
        var out: Bitmap? = null
        for (edge in intArrayOf(2048, 1440, 1024)) {
          try {
            out = render(uri, mode, level, edge)
            break
          } catch (e: OutOfMemoryError) {
            System.gc()
          }
        }
        val res = out ?: run { promise.resolve(unchanged); return@Thread }
        val dir = File(ctx.cacheDir, "photo-bg").apply { mkdirs() }
        // Old outputs from earlier picks are not needed once the photo was saved
        dir.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 6 * 3600_000L }?.forEach { it.delete() }
        val file = File(dir, "bg_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { res.compress(Bitmap.CompressFormat.JPEG, 97, it) }
        res.recycle()
        promise.resolve(Arguments.createMap().apply { putString("uri", "file://${file.absolutePath}"); putBoolean("changed", true) })
      } catch (t: Throwable) {
        // Model not downloaded yet, out of memory, unreadable photo: save the photo unchanged
        android.util.Log.w("OutfitPhotoBackground", "background skipped", t)
        promise.resolve(unchanged)
      }
    }.start()
  }
}

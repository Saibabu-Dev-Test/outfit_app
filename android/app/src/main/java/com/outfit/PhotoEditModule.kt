package com.outfit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
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
 * Photo options on the phone, before a photo is uploaded (no upload, nothing leaves the phone):
 *   edit(uri, { blurFaces?: boolean, cropX?, cropY?, cropW?, cropH? (0..1 of the photo) })
 *     1. blurFaces: ML Kit face detection (bundled model, works offline); every face found is
 *        pixelated + softened inside an oval grown ~25% around it (more on top for hair).
 *     2. crop: keeps only that part of the photo (the "Adjust" zoom / pan frame).
 * Resolves {uri: "file://...jpg", changed, faces} (faces = number of faces blurred, -1 when face
 * detection is not available). Never rejects: any failure resolves the photo unchanged, so a
 * photo is always uploaded. EXIF rotation is applied, long edge <= 2048. Runs on its own thread.
 */
class PhotoEditModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = "OutfitPhotoEdit"

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

  // Decoded, rotated, long edge <= edge, mutable ARGB_8888
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
    if (bmp.config != Bitmap.Config.ARGB_8888 || !bmp.isMutable) {
      val c = bmp.copy(Bitmap.Config.ARGB_8888, true)
      bmp.recycle()
      bmp = c
    }
    return bmp
  }

  private fun num(o: ReadableMap?, key: String): Double? =
    try { if (o != null && o.hasKey(key) && !o.isNull(key)) o.getDouble(key) else null } catch (_: Throwable) { null }

  private fun bool(o: ReadableMap?, key: String): Boolean =
    try { o != null && o.hasKey(key) && !o.isNull(key) && o.getBoolean(key) } catch (_: Throwable) { false }

  // Faces found -> pixelated + blurred ovals drawn over them. Returns the count, -1 when unavailable.
  private fun blurFaces(bmp: Bitmap): Int {
    val detector = try {
      FaceDetection.getClient(
        FaceDetectorOptions.Builder()
          .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
          .setMinFaceSize(0.04f)
          .build(),
      )
    } catch (t: Throwable) {
      android.util.Log.w("OutfitPhotoEdit", "face detector unavailable", t)
      return -1
    }
    val faces = try {
      Tasks.await(detector.process(InputImage.fromBitmap(bmp, 0)), 30, TimeUnit.SECONDS)
    } catch (t: Throwable) {
      android.util.Log.w("OutfitPhotoEdit", "face detection failed", t)
      return -1
    } finally {
      try { detector.close() } catch (_: Throwable) {}
    }
    if (faces.isEmpty()) return 0
    val w = bmp.width
    val h = bmp.height
    val canvas = Canvas(bmp)
    val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    var done = 0
    for (f in faces) {
      val b = f.boundingBox
      // Same padding as utils/cropMath.ts padFaceBox (25% around, +15% more on top for hair)
      val l = (b.left - b.width() * 0.25f).coerceIn(0f, w.toFloat())
      val t = (b.top - b.height() * 0.40f).coerceIn(0f, h.toFloat())
      val r = (b.right + b.width() * 0.25f).coerceIn(0f, w.toFloat())
      val btm = (b.bottom + b.height() * 0.25f).coerceIn(0f, h.toFloat())
      val rw = (r - l).roundToInt()
      val rh = (btm - t).roundToInt()
      if (rw < 4 || rh < 4) continue
      val src = Rect(l.roundToInt(), t.roundToInt(), l.roundToInt() + rw, t.roundToInt() + rh)
      src.right = min(src.right, w)
      src.bottom = min(src.bottom, h)
      if (src.width() < 4 || src.height() < 4) continue
      val region = Bitmap.createBitmap(bmp, src.left, src.top, src.width(), src.height())
      // Pixelate: ~9 blocks across the face, then soften the blocks with a filtered upscale
      val blocks = 9
      val sw = max(2, blocks)
      val sh = max(2, (blocks * src.height().toFloat() / src.width()).roundToInt())
      val tiny = Bitmap.createScaledBitmap(region, sw, sh, true)
      region.recycle()
      val mid = Bitmap.createScaledBitmap(tiny, sw * 3, sh * 3, false)
      tiny.recycle()
      val cover = Bitmap.createScaledBitmap(mid, src.width(), src.height(), true)
      mid.recycle()
      canvas.save()
      val oval = Path().apply { addOval(RectF(src), Path.Direction.CW) }
      canvas.clipPath(oval)
      canvas.drawBitmap(cover, null, src, paint)
      canvas.restore()
      cover.recycle()
      done++
    }
    return done
  }

  @ReactMethod
  fun edit(uri: String, opts: ReadableMap?, promise: Promise) {
    Thread {
      val unchanged = Arguments.createMap().apply {
        putString("uri", uri); putBoolean("changed", false); putInt("faces", 0)
      }
      try {
        var bmp = try { load(uri, 2048) } catch (e: OutOfMemoryError) { System.gc(); load(uri, 1280) }
        var changed = false
        var faces = 0
        if (bool(opts, "blurFaces")) {
          faces = blurFaces(bmp)
          if (faces > 0) changed = true
        }
        val cx = num(opts, "cropX")
        val cy = num(opts, "cropY")
        val cw = num(opts, "cropW")
        val ch = num(opts, "cropH")
        if (cx != null && cy != null && cw != null && ch != null && (cx > 0.002 || cy > 0.002 || cw < 0.996 || ch < 0.996)) {
          // Same rounding as utils/cropMath.ts cropPixels
          val w = bmp.width
          val h = bmp.height
          val x = (cx * w).roundToInt().coerceIn(0, max(0, w - 1))
          val y = (cy * h).roundToInt().coerceIn(0, max(0, h - 1))
          val pw = (cw * w).roundToInt().coerceIn(1, w - x)
          val ph = (ch * h).roundToInt().coerceIn(1, h - y)
          val cropped = Bitmap.createBitmap(bmp, x, y, pw, ph)
          if (cropped != bmp) bmp.recycle()
          bmp = cropped
          changed = true
        }
        if (!changed) {
          bmp.recycle()
          unchanged.putInt("faces", faces)
          promise.resolve(unchanged)
          return@Thread
        }
        val dir = File(ctx.cacheDir, "photo-edit").apply { mkdirs() }
        dir.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 6 * 3600_000L }?.forEach { it.delete() }
        val file = File(dir, "edit_${System.currentTimeMillis()}_${(Math.random() * 1e6).toInt()}.jpg")
        FileOutputStream(file).use { bmp.compress(Bitmap.CompressFormat.JPEG, 95, it) }
        bmp.recycle()
        promise.resolve(Arguments.createMap().apply {
          putString("uri", "file://${file.absolutePath}")
          putBoolean("changed", true)
          putInt("faces", faces)
        })
      } catch (t: Throwable) {
        android.util.Log.w("OutfitPhotoEdit", "edit skipped", t)
        promise.resolve(unchanged)
      }
    }.start()
  }
}

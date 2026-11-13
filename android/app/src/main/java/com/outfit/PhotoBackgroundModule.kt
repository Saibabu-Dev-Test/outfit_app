package com.outfit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
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
 * Speed: the model runs on a ~3x smaller copy (SegmentMath.MASK_EDGE), the model clients are
 * created once and reused (warmUp() loads them when a photo screen opens), and the full-size
 * photo is read / written in one multi-core pass. Timings are logged (adb logcat -s
 * OutfitPhotoBackground) and returned as `ms`.
 * Resolves {uri: "file://...jpg", changed: true, ms} with a new JPEG (long edge <= 2048, EXIF rotation
 * applied), or {uri: <same uri>, changed: false} when no subject was found or segmentation is not
 * available (model still downloading, old Play services). Never rejects for those cases, so a photo
 * is always saved. Runs on its own background thread.
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

  /**
   * Loads the segmentation + face models now (call when a photo screen opens) so the first
   * Blur / Remove BG tap does not pay the model start-up. Resolves true when ready.
   */
  @ReactMethod
  fun warmUp(promise: Promise) {
    worker.execute {
      val t0 = SystemClock.elapsedRealtime()
      try {
        val tiny = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        val img = InputImage.fromBitmap(tiny, 0)
        val seg = segmenter().process(img)
        try { Tasks.await(faceDetector().process(img), 5, TimeUnit.SECONDS) } catch (_: Throwable) {}
        Tasks.await(seg, 20, TimeUnit.SECONDS)
        tiny.recycle()
        Log.i(TAG, "warm-up ${SystemClock.elapsedRealtime() - t0} ms")
        promise.resolve(true)
      } catch (t: Throwable) {
        Log.w(TAG, "warm-up failed (model may still be downloading)", t)
        promise.resolve(false)
      }
    }
  }

  // Segmentation + background on one decoded photo (long edge <= edge). Null = keep the photo.
  private fun render(uri: String, mode: String, level: Int, edge: Int, times: StringBuilder): Bitmap? {
    var t = SystemClock.elapsedRealtime()
    fun lap(name: String) { val now = SystemClock.elapsedRealtime(); times.append(name).append(' ').append(now - t).append(" ms, "); t = now }
    val bmp = load(uri, edge)
    val w = bmp.width
    val h = bmp.height
    val px = IntArray(w * h)
    try {
      bmp.getPixels(px, 0, w, 0, 0, w, h)
    } finally {
      bmp.recycle()
    }
    lap("decode ${w}x$h")
    // The model runs on a ~3x smaller copy (long edge <= 768): fast; the full photo only guides the edge
    val s = SegmentMath.maskScale(w, h)
    val sw = (w + s - 1) / s
    val sh = (h + s - 1) / s
    val lowPx = SegmentMath.downsampleArgb(px, w, h, s)
    val small = Bitmap.createBitmap(lowPx, sw, sh, Bitmap.Config.ARGB_8888)
    var conf: FloatArray? = null
    var heads: IntArray? = null
    try {
      val img = InputImage.fromBitmap(small, 0)
      val segTask = segmenter().process(img)
      val faceTask = try { faceDetector().process(img) } catch (_: Throwable) { null }
      val result = Tasks.await(segTask, 30, TimeUnit.SECONDS)
      val mask = result.foregroundConfidenceMask
      val n = sw * sh
      if (mask != null) {
        mask.rewind()
        if (mask.remaining() >= n) {
          val c = FloatArray(n)
          mask.get(c, 0, n)
          conf = c
        }
      }
      lap("segment ${sw}x$sh")
      heads = try { faceTask?.let { faceBoxes(Tasks.await(it, 3, TimeUnit.SECONDS), sw, sh) } } catch (_: Throwable) { null }
      lap("faces")
    } finally {
      small.recycle()
    }
    if (conf == null) return null
    val out = SegmentMath.process(px, conf, w, h, if (mode == "blur") "blur" else "plain", level, heads, s, lowPx) ?: return null
    lap("matte+composite")
    val res = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    res.setPixels(out, 0, w, 0, 0, w, h)
    return res
  }

  /**
   * Face boxes widened to cover ears, glasses temples and hair ([l, t, r, b] quads, mask-grid
   * pixels), where the mask gets a lower bar. Null when no face.
   */
  private fun faceBoxes(faces: List<Face>, w: Int, h: Int): IntArray? {
    if (faces.isEmpty()) return null
    val out = IntArray(faces.size * 4)
    faces.forEachIndexed { j, f ->
      val b = f.boundingBox
      val fw = b.width()
      val fh = b.height()
      out[j * 4] = (b.left - fw * 0.3f).roundToInt().coerceIn(0, w)
      out[j * 4 + 1] = (b.top - fh * 0.45f).roundToInt().coerceIn(0, h)
      out[j * 4 + 2] = (b.right + fw * 0.3f).roundToInt().coerceIn(0, w)
      out[j * 4 + 3] = (b.bottom + fh * 0.1f).roundToInt().coerceIn(0, h)
    }
    return out
  }

  private fun runJob(uri: String, mode: String, level: Int, promise: Promise) {
    worker.execute {
      val unchanged = Arguments.createMap().apply { putString("uri", uri); putBoolean("changed", false) }
      val t0 = SystemClock.elapsedRealtime()
      val times = StringBuilder()
      try {
        // Saved at 2048 px (Adjust / zoom never shows an upscaled edge); a phone short on
        // memory gets a smaller (still clear) copy.
        var out: Bitmap? = null
        for (edge in intArrayOf(2048, 1440, 1024)) {
          try {
            times.setLength(0)
            out = render(uri, mode, level, edge, times)
            break
          } catch (e: OutOfMemoryError) {
            System.gc()
          }
        }
        val res = out ?: run {
          Log.i(TAG, "no subject / unavailable: ${times}total ${SystemClock.elapsedRealtime() - t0} ms")
          promise.resolve(unchanged)
          return@execute
        }
        val te = SystemClock.elapsedRealtime()
        val dir = File(ctx.cacheDir, "photo-bg").apply { mkdirs() }
        // Old outputs from earlier picks are not needed once the photo was saved
        dir.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 6 * 3600_000L }?.forEach { it.delete() }
        val file = File(dir, "bg_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { res.compress(Bitmap.CompressFormat.JPEG, 95, it) }
        res.recycle()
        val total = SystemClock.elapsedRealtime() - t0
        Log.i(TAG, "$mode: ${times}encode ${SystemClock.elapsedRealtime() - te} ms, total $total ms")
        promise.resolve(Arguments.createMap().apply {
          putString("uri", "file://${file.absolutePath}")
          putBoolean("changed", true)
          putInt("ms", total.toInt())
        })
      } catch (t: Throwable) {
        // Model not downloaded yet, out of memory, unreadable photo: save the photo unchanged
        Log.w(TAG, "background skipped", t)
        promise.resolve(unchanged)
      }
    }
  }

  companion object {
    private const val TAG = "OutfitPhotoBackground"

    /** One job at a time, off the UI / JS threads (the matte itself fans out over a few cores). */
    private val worker: ExecutorService = Executors.newSingleThreadExecutor { r -> Thread(r, "outfit-photo-bg") }

    // Model clients are created once and reused (creating them per photo cost a model load each time)
    @Volatile private var seg: SubjectSegmenter? = null
    @Volatile private var face: FaceDetector? = null

    @Synchronized fun segmenter(): SubjectSegmenter =
      seg ?: SubjectSegmentation.getClient(
        SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build(),
      ).also { seg = it }

    @Synchronized fun faceDetector(): FaceDetector =
      face ?: FaceDetection.getClient(
        FaceDetectorOptions.Builder().setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST).setMinFaceSize(0.05f).build(),
      ).also { face = it }
  }
}

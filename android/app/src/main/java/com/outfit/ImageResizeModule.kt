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
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Shrinks a photo to a small JPEG for Firestore (no Cloud Storage on the free Spark plan).
 * resize(uri, maxEdge, maxBytes): uri is a content:// / file:// path from the image picker or a
 * data: URI. Applies the EXIF rotation, scales the long edge down to maxEdge, flattens
 * transparency on white, then lowers the JPEG quality (and, if needed, the size) until the
 * file is at most maxBytes. Resolves {base64, width, height, bytes}. Runs off the UI thread.
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
      ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
      else -> return src
    }
    val out = Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
    if (out != src) src.recycle()
    return out
  }

  // Long edge <= edge, drawn on white (JPEG has no transparency)
  private fun fit(src: Bitmap, edge: Int): Bitmap {
    val long = max(src.width, src.height)
    val scale = if (long > edge) edge.toFloat() / long else 1f
    val w = max(1, (src.width * scale).roundToInt())
    val h = max(1, (src.height * scale).roundToInt())
    val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(out)
    c.drawColor(Color.WHITE)
    val p = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    val scaled = Bitmap.createScaledBitmap(src, w, h, true)
    c.drawBitmap(scaled, 0f, 0f, p)
    if (scaled != src) scaled.recycle()
    return out
  }

  @ReactMethod
  fun resize(uri: String, maxEdge: Int, maxBytes: Int, promise: Promise) {
    Thread {
      try {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        open(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw IllegalArgumentException("Not an image")
        // Power-of-two subsampling while the decoded long edge stays >= maxEdge (saves memory)
        var sample = 1
        val long = max(bounds.outWidth, bounds.outHeight)
        while (long / (sample * 2) >= maxEdge) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }
        val decoded = open(uri).use { BitmapFactory.decodeStream(it, null, opts) }
          ?: throw IllegalArgumentException("Could not decode the photo")
        val upright = rotate(decoded, orientation(uri))

        var edge = maxEdge
        var best: ByteArray? = null
        var bw = 0
        var bh = 0
        for (round in 0 until 5) {
          val bmp = fit(upright, edge)
          var q = 82
          var bytes: ByteArray
          while (true) {
            val bos = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, q, bos)
            bytes = bos.toByteArray()
            if (bytes.size <= maxBytes || q <= 35) break
            q -= 7
          }
          best = bytes
          bw = bmp.width
          bh = bmp.height
          bmp.recycle()
          if (bytes.size <= maxBytes) break
          edge = max(64, (edge * 0.85f).roundToInt())
        }
        upright.recycle()
        val out = best ?: throw IllegalStateException("No output")
        val map = Arguments.createMap()
        map.putString("base64", Base64.encodeToString(out, Base64.NO_WRAP))
        map.putInt("width", bw)
        map.putInt("height", bh)
        map.putInt("bytes", out.size)
        promise.resolve(map)
      } catch (e: Throwable) {
        promise.reject("RESIZE_FAILED", e.message ?: "Could not read the photo", e)
      }
    }.start()
  }

  companion object {
    const val NAME = "OutfitImageResize"
  }
}

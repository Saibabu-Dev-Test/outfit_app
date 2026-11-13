package com.outfit

import android.graphics.Color
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions

// Wardrobe auto tags (on the phone, free, Google Play services ML Kit model: nothing added to the APK):
//  - labels(uri): Image Labeling -> [{text, confidence}] used for category suggestions.
//  - dominantColor(uri): average colour of the middle of the photo -> "#RRGGBB".
// Background removal stays in PhotoBackgroundModule. Lazy + guarded: nothing runs at app start;
// every error is a rejection and the app falls back to manual category / colour.
class WardrobeVisionModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "OutfitVision"

  private fun input(uri: String): InputImage = InputImage.fromFilePath(reactApplicationContext, Uri.parse(uri))

  // Average colour of the middle of the photo, ignoring near-white background: "#RRGGBB"
  @ReactMethod
  fun dominantColor(uri: String, promise: Promise) {
    try {
      val opts = android.graphics.BitmapFactory.Options().apply { inSampleSize = 8 }
      val bmp = reactApplicationContext.contentResolver.openInputStream(Uri.parse(uri)).use {
        android.graphics.BitmapFactory.decodeStream(it, null, opts)
      } ?: run { promise.reject("DECODE", "Could not read photo"); return }
      var r = 0L; var g = 0L; var b = 0L; var n = 0L
      val x0 = bmp.width / 4; val x1 = bmp.width * 3 / 4
      val y0 = bmp.height / 4; val y1 = bmp.height * 3 / 4
      for (y in y0 until y1 step 2) for (x in x0 until x1 step 2) {
        val p = bmp.getPixel(x, y)
        val pr = Color.red(p); val pg = Color.green(p); val pb = Color.blue(p)
        if (pr > 240 && pg > 240 && pb > 240) continue
        r += pr; g += pg; b += pb; n++
      }
      bmp.recycle()
      if (n == 0L) { promise.resolve("#FFFFFF"); return }
      promise.resolve(String.format("#%02X%02X%02X", (r / n).toInt(), (g / n).toInt(), (b / n).toInt()))
    } catch (t: Throwable) {
      promise.reject("COLOR_FAILED", t.message ?: "Colour failed", t)
    }
  }

  @ReactMethod
  fun labels(uri: String, promise: Promise) {
    try {
      val labeler = ImageLabeling.getClient(ImageLabelerOptions.Builder().setConfidenceThreshold(0.5f).build())
      labeler.process(input(uri))
        .addOnSuccessListener { list ->
          val arr = Arguments.createArray()
          list.forEach { l ->
            val m = Arguments.createMap()
            m.putString("text", l.text)
            m.putDouble("confidence", l.confidence.toDouble())
            arr.pushMap(m)
          }
          try { labeler.close() } catch (_: Throwable) {}
          promise.resolve(arr)
        }
        .addOnFailureListener { e ->
          try { labeler.close() } catch (_: Throwable) {}
          promise.reject("LABEL_FAILED", e.message ?: "Labeling unavailable", e)
        }
    } catch (t: Throwable) {
      promise.reject("MLKIT_ERROR", t.message ?: "ML Kit unavailable", t)
    }
  }
}

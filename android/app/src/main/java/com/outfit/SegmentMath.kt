package com.outfit

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Pure maths for PhotoBackgroundModule (no Android classes, so it is unit tested on the JVM:
 * android/app/src/test/java/com/outfit/SegmentMathTest.kt).
 *
 * Pixels are ARGB ints (android.graphics.Color layout), masks are FloatArrays (0..1) of w * h.
 * Everything runs on the full-resolution photo: the ML Kit confidence mask has the photo's own
 * size, so nothing is upscaled from a small mask.
 *
 *  refineAlpha: ML Kit foreground confidence -> soft alpha that keeps the subject's edges
 *    (hair, shoulders, sleeves, curves). The mask only gives a soft prior (low threshold, never a
 *    hard cut) and an edge band ~12 px around the subject; inside the band every pixel's alpha is
 *    solved from its own colour against the local sure-subject (F) and sure-background (B)
 *    colours (I = a F + (1 - a) B), so the outline follows the real edge in the photo even where
 *    the model's mask is blocky or a few px short. Where F and B look alike the soft mask is
 *    kept. The confident core is always whole; a 1 px feather anti-aliases the outline.
 *  backgroundBlur: the background blurred WITHOUT the subject's colours (normalised convolution
 *    weighted by 1 - alpha), so no glow / smear of the person bleeds around the outline.
 *  composite: subject colours un-mixed from the old background at the edge pixels
 *    (F = (I - (1 - a) * B) / a), then laid over the new background: no halo of the old
 *    background around the subject, the subject itself stays the original sharp pixels.
 */
object SegmentMath {

  fun smoothstep(e0: Float, e1: Float, x: Float): Float {
    val t = ((x - e0) / (e1 - e0)).coerceIn(0f, 1f)
    return t * t * (3f - 2f * t)
  }

  /** Pixel scale of the tuning numbers below (they are for a 2048 px long edge). */
  fun scaleFor(w: Int, h: Int): Float = max(w, h) / 2048f

  fun luminance(px: IntArray): FloatArray {
    val out = FloatArray(px.size)
    for (i in px.indices) {
      val p = px[i]
      out[i] = (0.299f * ((p shr 16) and 0xFF) + 0.587f * ((p shr 8) and 0xFF) + 0.114f * (p and 0xFF)) / 255f
    }
    return out
  }

  // Separable max filter (dilation), square window of radius r, edges clamped
  fun maxFilter(src: FloatArray, w: Int, h: Int, r: Int): FloatArray {
    if (r <= 0) return src.copyOf()
    val tmp = FloatArray(src.size)
    for (y in 0 until h) {
      val row = y * w
      for (x in 0 until w) {
        var m = 0f
        val a = max(0, x - r)
        val b = min(w - 1, x + r)
        for (k in a..b) { val v = src[row + k]; if (v > m) m = v }
        tmp[row + x] = m
      }
    }
    val out = FloatArray(src.size)
    for (x in 0 until w) {
      for (y in 0 until h) {
        var m = 0f
        val a = max(0, y - r)
        val b = min(h - 1, y + r)
        for (k in a..b) { val v = tmp[k * w + x]; if (v > m) m = v }
        out[y * w + x] = m
      }
    }
    return out
  }

  // Box mean of radius r (sliding window, separable, window shrinks at the edges). O(n).
  fun boxBlur(src: FloatArray, w: Int, h: Int, r: Int): FloatArray {
    if (r <= 0) return src.copyOf()
    val tmp = FloatArray(src.size)
    for (y in 0 until h) {
      val row = y * w
      var sum = 0.0
      var cnt = 0
      for (k in 0..min(w - 1, r)) { sum += src[row + k]; cnt++ }
      for (x in 0 until w) {
        tmp[row + x] = (sum / cnt).toFloat()
        val add = x + r + 1
        val rem = x - r
        if (add < w) { sum += src[row + add]; cnt++ }
        if (rem >= 0) { sum -= src[row + rem]; cnt-- }
      }
    }
    val out = FloatArray(src.size)
    for (x in 0 until w) {
      var sum = 0.0
      var cnt = 0
      for (k in 0..min(h - 1, r)) { sum += tmp[k * w + x]; cnt++ }
      for (y in 0 until h) {
        out[y * w + x] = (sum / cnt).toFloat()
        val add = y + r + 1
        val rem = y - r
        if (add < h) { sum += tmp[add * w + x]; cnt++ }
        if (rem >= 0) { sum -= tmp[rem * w + x]; cnt-- }
      }
    }
    return out
  }

  /** Average of s x s cells (edge cells are partial). Size ceil(w / s) x ceil(h / s). */
  fun downsample(src: FloatArray, w: Int, h: Int, s: Int): FloatArray {
    val sw = (w + s - 1) / s
    val sh = (h + s - 1) / s
    val sum = FloatArray(sw * sh)
    val cnt = IntArray(sw * sh)
    for (y in 0 until h) {
      val sy = (y / s) * sw
      val row = y * w
      for (x in 0 until w) {
        val c = sy + x / s
        sum[c] += src[row + x]
        cnt[c]++
      }
    }
    for (i in sum.indices) if (cnt[i] > 0) sum[i] /= cnt[i]
    return sum
  }

  /** Bilinear upscale of a downsample() grid back to w x h (cell centres aligned). */
  fun upsample(small: FloatArray, w: Int, h: Int, s: Int): FloatArray {
    val sw = (w + s - 1) / s
    val sh = (h + s - 1) / s
    val out = FloatArray(w * h)
    for (y in 0 until h) {
      val fy = ((y + 0.5f) / s - 0.5f).coerceIn(0f, (sh - 1).toFloat())
      val y0 = fy.toInt()
      val y1 = min(sh - 1, y0 + 1)
      val ty = fy - y0
      for (x in 0 until w) {
        val fx = ((x + 0.5f) / s - 0.5f).coerceIn(0f, (sw - 1).toFloat())
        val x0 = fx.toInt()
        val x1 = min(sw - 1, x0 + 1)
        val tx = fx - x0
        val a = small[y0 * sw + x0] * (1 - tx) + small[y0 * sw + x1] * tx
        val b = small[y1 * sw + x0] * (1 - tx) + small[y1 * sw + x1] * tx
        out[y * w + x] = a * (1 - ty) + b * ty
      }
    }
    return out
  }

  /**
   * ML Kit foreground confidence (0..1, full size) -> final soft alpha (0..1, full size).
   * [lum] is the photo's luminance (0..1) used as the edge guide.
   */
  fun refineAlpha(px: IntArray, conf: FloatArray, w: Int, h: Int): FloatArray {
    val k = scaleFor(w, h)
    val n = w * h
    // Prior: soft, low threshold (uncertain edge pixels such as hair or thin sleeves count partly)
    val soft = FloatArray(n)
    for (i in 0 until n) soft[i] = smoothstep(0.08f, 0.55f, conf[i])
    // Edge band: everything within ~12 px of the subject may still be subject
    val band = max(3, (12 * k).roundToInt())
    val near = maxFilter(soft, w, h, band)
    for (i in 0 until n) near[i] = smoothstep(0f, 0.1f, near[i]) // 1 = may be subject
    // Local colours of the sure subject (F) and the sure background (B) around every pixel
    val fgW = FloatArray(n)
    val bgW = FloatArray(n)
    for (i in 0 until n) {
      fgW[i] = smoothstep(0.6f, 0.92f, conf[i])
      bgW[i] = 1f - near[i]
    }
    val radius = max(6, (32 * k).roundToInt())
    val fg = weightedMeanGrid(px, fgW, w, h, radius)
    val bg = weightedMeanGrid(px, bgW, w, h, radius)
    val reach = boxBlur(near, w, h, max(1, (2 * k).roundToInt()))
    val f = FloatArray(4)
    val g = FloatArray(4)
    val a = FloatArray(n)
    for (y in 0 until h) {
      for (x in 0 until w) {
        val i = y * w + x
        val core = fgW[i]
        if (core >= 1f || reach[i] <= 0f) { a[i] = core; continue }
        var est = soft[i]
        fg.at(x, y, f)
        bg.at(x, y, g)
        if (f[3] > 0.0005f && g[3] > 0.0005f) {
          // Closed-form alpha from the local subject / background colours: I = a F + (1 - a) B
          val dr = f[0] - g[0]; val dg = f[1] - g[1]; val db = f[2] - g[2]
          val l2 = dr * dr + dg * dg + db * db
          val sure = smoothstep(30f * 30f, 80f * 80f, l2) // colours clearly different?
          if (sure > 0f) {
            val p = px[i]
            val ir = ((p shr 16) and 0xFF) - g[0]
            val ig = ((p shr 8) and 0xFF) - g[1]
            val ib = (p and 0xFF) - g[2]
            // (small dead zone at both ends: background texture / subject shading is not "partial")
            val t = (((ir * dr + ig * dg + ib * db) / l2 - 0.04f) / 0.92f).coerceIn(0f, 1f)
            est = t * sure + est * (1 - sure)
          }
        }
        a[i] = max(core, min(est, reach[i])).coerceIn(0f, 1f)
      }
    }
    // 1 px feather: anti-aliased outline, no jaggies (the sure core stays whole)
    val out = boxBlur(a, w, h, max(1, k.roundToInt()))
    for (i in 0 until n) out[i] = max(out[i], fgW[i]).coerceIn(0f, 1f)
    return out
  }

  /** Weighted local mean colours on a coarse grid (cells of s px), sampled bilinearly with at(). */
  class ColourGrid(val sw: Int, val sh: Int, val s: Int, val r: FloatArray, val g: FloatArray, val b: FloatArray, val wt: FloatArray) {
    /** out = [r, g, b, weight] at full-size pixel (x, y). */
    fun at(x: Int, y: Int, out: FloatArray) {
      val fy = ((y + 0.5f) / s - 0.5f).coerceIn(0f, (sh - 1).toFloat())
      val fx = ((x + 0.5f) / s - 0.5f).coerceIn(0f, (sw - 1).toFloat())
      val y0 = fy.toInt(); val x0 = fx.toInt()
      val y1 = min(sh - 1, y0 + 1); val x1 = min(sw - 1, x0 + 1)
      val ty = fy - y0; val tx = fx - x0
      val i00 = y0 * sw + x0; val i01 = y0 * sw + x1; val i10 = y1 * sw + x0; val i11 = y1 * sw + x1
      val w00 = (1 - tx) * (1 - ty); val w01 = tx * (1 - ty); val w10 = (1 - tx) * ty; val w11 = tx * ty
      out[0] = r[i00] * w00 + r[i01] * w01 + r[i10] * w10 + r[i11] * w11
      out[1] = g[i00] * w00 + g[i01] * w01 + g[i10] * w10 + g[i11] * w11
      out[2] = b[i00] * w00 + b[i01] * w01 + b[i10] * w10 + b[i11] * w11
      out[3] = wt[i00] * w00 + wt[i01] * w01 + wt[i10] * w10 + wt[i11] * w11
    }
  }

  /**
   * Normalised convolution: the mean colour around each pixel counting every pixel with its
   * weight (0..1), blurred ~Gaussian with sigma ~[radius] px. Where (almost) no weight is near,
   * the plain local mean is used. wt = local mean weight (how much the colour can be trusted).
   */
  fun weightedMeanGrid(px: IntArray, weight: FloatArray, w: Int, h: Int, radius: Int): ColourGrid {
    val s = (radius / 4).coerceIn(1, 8)
    val sw = (w + s - 1) / s
    val sh = (h + s - 1) / s
    val m = sw * sh
    val pr = FloatArray(m); val pg = FloatArray(m); val pb = FloatArray(m); val pw = FloatArray(m)
    val ur = FloatArray(m); val ug = FloatArray(m); val ub = FloatArray(m)
    val cnt = IntArray(m)
    for (y in 0 until h) {
      val sy = (y / s) * sw
      val row = y * w
      for (x in 0 until w) {
        val c = sy + x / s
        val p = px[row + x]
        val r = ((p shr 16) and 0xFF).toFloat()
        val g = ((p shr 8) and 0xFF).toFloat()
        val b = (p and 0xFF).toFloat()
        val wt = weight[row + x]
        pr[c] += r * wt; pg[c] += g * wt; pb[c] += b * wt; pw[c] += wt
        ur[c] += r; ug[c] += g; ub[c] += b
        cnt[c]++
      }
    }
    for (i in 0 until m) {
      val n = max(1, cnt[i]).toFloat()
      pr[i] /= n; pg[i] /= n; pb[i] /= n; pw[i] /= n; ur[i] /= n; ug[i] /= n; ub[i] /= n
    }
    // 3 box passes ~ Gaussian with sigma ~ rs cells
    val rs = max(1, (radius.toFloat() / s).roundToInt())
    fun blur3(a: FloatArray): FloatArray = boxBlur(boxBlur(boxBlur(a, sw, sh, rs), sw, sh, rs), sw, sh, rs)
    val br = blur3(pr); val bg = blur3(pg); val bb = blur3(pb); val bw = blur3(pw)
    val vr = blur3(ur); val vg = blur3(ug); val vb = blur3(ub)
    for (i in 0 until m) {
      val wt = bw[i]
      // Little weight near: blend smoothly towards the plain mean
      val t = (wt / 0.001f).coerceIn(0f, 1f)
      val nr = if (wt > 1e-6f) br[i] / wt else vr[i]
      val ng = if (wt > 1e-6f) bg[i] / wt else vg[i]
      val nb = if (wt > 1e-6f) bb[i] / wt else vb[i]
      br[i] = nr * t + vr[i] * (1 - t); bg[i] = ng * t + vg[i] * (1 - t); bb[i] = nb * t + vb[i] * (1 - t)
    }
    return ColourGrid(sw, sh, s, br, bg, bb, bw)
  }

  /** Share of the photo that is clearly subject (alpha > 0.5). */
  fun subjectShare(alpha: FloatArray): Float {
    if (alpha.isEmpty()) return 0f
    var c = 0
    for (a in alpha) if (a > 0.5f) c++
    return c.toFloat() / alpha.size
  }

  /** Average luminance (0..255) of the subject, weighted by alpha. */
  fun subjectLuminance(px: IntArray, alpha: FloatArray): Double {
    var s = 0.0
    var ws = 0.0
    for (i in px.indices) {
      val a = alpha[i]
      if (a <= 0.5f) continue
      val p = px[i]
      s += (0.299 * ((p shr 16) and 0xFF) + 0.587 * ((p shr 8) and 0xFF) + 0.114 * (p and 0xFF)) * a
      ws += a
    }
    return if (ws > 0) s / ws else 128.0
  }

  /** Blur radius (px at this photo size) for blur level 1..5. */
  fun blurRadius(level: Int, w: Int, h: Int): Int {
    val base = when (level.coerceIn(1, 5)) { 1 -> 8; 2 -> 14; 3 -> 22; 4 -> 32; else -> 46 }
    return max(2, (base * scaleFor(w, h)).roundToInt())
  }

  /**
   * The background only, blurred with roughly Gaussian strength [radius] px, without the subject's
   * colours (each pixel counts with weight 1 - alpha). [dim] < 1 darkens it slightly so the subject
   * stands out. Returns opaque ARGB pixels at full size (smooth bilinear upscale of the blur grid).
   */
  fun backgroundBlur(px: IntArray, alpha: FloatArray, w: Int, h: Int, radius: Int, dim: Float): IntArray {
    val wt = FloatArray(w * h)
    for (i in wt.indices) wt[i] = 1f - alpha[i]
    val grid = weightedMeanGrid(px, wt, w, h, radius)
    val c = FloatArray(4)
    val out = IntArray(w * h)
    for (y in 0 until h) {
      for (x in 0 until w) {
        grid.at(x, y, c)
        val r = (c[0] * dim).roundToInt().coerceIn(0, 255)
        val g = (c[1] * dim).roundToInt().coerceIn(0, 255)
        val b = (c[2] * dim).roundToInt().coerceIn(0, 255)
        out[y * w + x] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
      }
    }
    return out
  }

  /**
   * Subject over a new background. [oldBg] is a local estimate of the background behind the
   * subject (backgroundBlur with a small radius), used to un-mix the old background out of the
   * edge pixels (no halo). Fully opaque subject pixels are copied unchanged (stay sharp).
   */
  fun composite(px: IntArray, alpha: FloatArray, newBg: IntArray, oldBg: IntArray?): IntArray {
    val out = IntArray(px.size)
    for (i in px.indices) {
      val a = alpha[i]
      val p = px[i]
      if (a >= 0.999f) { out[i] = p or (0xFF shl 24); continue }
      val n = newBg[i]
      if (a <= 0.001f) { out[i] = n or (0xFF shl 24); continue }
      var r = ((p shr 16) and 0xFF).toFloat()
      var g = ((p shr 8) and 0xFF).toFloat()
      var b = (p and 0xFF).toFloat()
      if (oldBg != null) {
        // Foreground colour without the old background mixed in: F = (I - (1 - a) B) / a
        val o = oldBg[i]
        val ia = 1f / max(a, 0.05f)
        val ob = 1f - a
        r = ((r - ob * ((o shr 16) and 0xFF)) * ia).coerceIn(0f, 255f)
        g = ((g - ob * ((o shr 8) and 0xFF)) * ia).coerceIn(0f, 255f)
        b = ((b - ob * (o and 0xFF)) * ia).coerceIn(0f, 255f)
      }
      val rr = (r * a + ((n shr 16) and 0xFF) * (1 - a)).roundToInt().coerceIn(0, 255)
      val gg = (g * a + ((n shr 8) and 0xFF) * (1 - a)).roundToInt().coerceIn(0, 255)
      val bb = (b * a + (n and 0xFF) * (1 - a)).roundToInt().coerceIn(0, 255)
      out[i] = (0xFF shl 24) or (rr shl 16) or (gg shl 8) or bb
    }
    return out
  }

  /**
   * Whole pipeline on the full-size photo. mode "blur" (level 1..5) or "plain" (solid black behind
   * light clothes, white behind dark ones). Null when there is no clear subject (keep the photo).
   */
  fun process(px: IntArray, conf: FloatArray, w: Int, h: Int, mode: String, level: Int): IntArray? {
    val alpha = refineAlpha(px, conf, w, h)
    val share = subjectShare(alpha)
    if (share < 0.02f || share > 0.98f) return null
    val oldBg = backgroundBlur(px, alpha, w, h, max(3, (6 * scaleFor(w, h)).roundToInt()), 1f)
    val newBg = if (mode == "blur") {
      backgroundBlur(px, alpha, w, h, blurRadius(level, w, h), 0.9f)
    } else {
      val solid = if (subjectLuminance(px, alpha) >= 140.0) 0xFF000000.toInt() else 0xFFFFFFFF.toInt()
      IntArray(w * h) { solid }
    }
    return composite(px, alpha, newBg, oldBg)
  }
}

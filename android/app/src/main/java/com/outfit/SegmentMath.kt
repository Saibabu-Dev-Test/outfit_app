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
 *  refineAlpha: ML Kit foreground confidence -> soft alpha that keeps the WHOLE person incl.
 *    loose clothing (saree, dupatta, dress hem, sleeves) and the ears / glasses / hair: cleaned
 *    shape (low threshold, main pieces only, holes filled, closed, slightly dilated), then the
 *    model's soft confidence refined by a colour guided filter so the edge is smooth and follows
 *    the photo, plus a light feather.
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
   * Confidence at or above this is subject, kept whole. ML Kit is often only 0.3-0.6 sure about
   * loose clothing (saree pallu, dupatta, flared dress / lehenga hem, jacket sleeves) because it
   * looks unlike a body; the old 0.6-0.9 "sure" level plus colour re-matting cut those parts away.
   */
  const val KEEP_THRESHOLD = 0.35f

  /** Around detected faces (ears, glasses temples, hair) the model is less sure: lower bar there. */
  const val HEAD_THRESHOLD = 0.15f

  /** Enclosed gaps in the subject up to this share of the photo are filled (missed folds / pleats). */
  const val MAX_HOLE_SHARE = 0.004f

  /** Separate foreground pieces smaller than this share of the biggest one are dropped (specks). */
  const val MIN_PIECE_OF_LARGEST = 0.15f

  /** Morphological erosion (min filter) of a 0..1 mask. */
  fun minFilter(src: FloatArray, w: Int, h: Int, r: Int): FloatArray {
    val inv = FloatArray(src.size) { 1f - src[it] }
    val d = maxFilter(inv, w, h, r)
    for (i in d.indices) d[i] = 1f - d[i]
    return d
  }

  /**
   * Keeps only the big 4-connected foreground pieces of binary [keep] (the person); islands smaller
   * than MIN_PIECE_OF_LARGEST of the largest piece (background specks the model half-believed)
   * are cleared. In place.
   */
  fun keepMainPieces(keep: FloatArray, w: Int, h: Int) {
    val n = w * h
    val label = IntArray(n) // 0 = none, else piece id
    val q = IntArray(n)
    val sizes = ArrayList<Int>()
    sizes.add(0)
    for (s0 in 0 until n) {
      if (keep[s0] < 0.5f || label[s0] != 0) continue
      val id = sizes.size
      var head = 0
      var tail = 0
      label[s0] = id
      q[tail++] = s0
      while (head < tail) {
        val i = q[head++]
        val x = i % w
        if (x > 0 && keep[i - 1] >= 0.5f && label[i - 1] == 0) { label[i - 1] = id; q[tail++] = i - 1 }
        if (x < w - 1 && keep[i + 1] >= 0.5f && label[i + 1] == 0) { label[i + 1] = id; q[tail++] = i + 1 }
        if (i >= w && keep[i - w] >= 0.5f && label[i - w] == 0) { label[i - w] = id; q[tail++] = i - w }
        if (i < n - w && keep[i + w] >= 0.5f && label[i + w] == 0) { label[i + w] = id; q[tail++] = i + w }
      }
      sizes.add(tail)
    }
    if (sizes.size <= 2) return
    val largest = sizes.maxOrNull() ?: return
    val min = largest * MIN_PIECE_OF_LARGEST
    for (i in 0 until n) { val l = label[i]; if (l != 0 && sizes[l] < min) keep[i] = 0f }
  }

  /**
   * Sets to 1 every 0-region of [keep] (binary 0/1) that does not touch the photo border and has
   * at most [maxArea] pixels: gaps the model left inside the dress. Larger enclosed regions (a
   * real gap between arm and body) stay background.
   */
  fun fillHoles(keep: FloatArray, w: Int, h: Int, maxArea: Int) {
    val n = w * h
    if (maxArea <= 0 || n == 0) return
    // 0 = unvisited background, 1 = subject, 2 = background reached from the border, 3 = labelled
    val st = ByteArray(n)
    for (i in 0 until n) if (keep[i] >= 0.5f) st[i] = 1
    val q = IntArray(n)
    var head = 0
    var tail = 0
    fun seed(i: Int) { if (st[i].toInt() == 0) { st[i] = 2; q[tail++] = i } }
    for (x in 0 until w) { seed(x); seed((h - 1) * w + x) }
    for (y in 0 until h) { seed(y * w); seed(y * w + w - 1) }
    while (head < tail) {
      val i = q[head++]
      val x = i % w
      if (x > 0) seed(i - 1)
      if (x < w - 1) seed(i + 1)
      if (i >= w) seed(i - w)
      if (i < n - w) seed(i + w)
    }
    for (s0 in 0 until n) {
      if (st[s0].toInt() != 0) continue
      head = 0
      tail = 0
      st[s0] = 3
      q[tail++] = s0
      while (head < tail) {
        val i = q[head++]
        val x = i % w
        if (x > 0 && st[i - 1].toInt() == 0) { st[i - 1] = 3; q[tail++] = i - 1 }
        if (x < w - 1 && st[i + 1].toInt() == 0) { st[i + 1] = 3; q[tail++] = i + 1 }
        if (i >= w && st[i - w].toInt() == 0) { st[i - w] = 3; q[tail++] = i - w }
        if (i < n - w && st[i + w].toInt() == 0) { st[i + w] = 3; q[tail++] = i + w }
      }
      if (tail <= maxArea) for (j in 0 until tail) keep[q[j]] = 1f
    }
  }

  /**
   * Fast colour guided filter (He et al.): edge-aware smoothing of [p] (0..1) that follows the
   * edges of the RGB photo [px]. [r] and [eps] are for colours scaled 0..1 at full size. The
   * linear coefficients are solved on a grid subsampled by [s] and upsampled bilinearly (smooth,
   * never nearest), then applied to every full-size pixel: q = a . I + b.
   */
  fun guidedFilter(px: IntArray, p: FloatArray, w: Int, h: Int, r: Int, eps: Float, s: Int): FloatArray {
    val n = w * h
    val cr = FloatArray(n); val cg = FloatArray(n); val cb = FloatArray(n)
    for (i in 0 until n) {
      val v = px[i]
      cr[i] = ((v shr 16) and 0xFF) / 255f; cg[i] = ((v shr 8) and 0xFF) / 255f; cb[i] = (v and 0xFF) / 255f
    }
    val sw = (w + s - 1) / s
    val sh = (h + s - 1) / s
    val ir = downsample(cr, w, h, s); val ig = downsample(cg, w, h, s); val ib = downsample(cb, w, h, s)
    val ps = downsample(p, w, h, s)
    val rs = max(1, (r.toFloat() / s).roundToInt())
    fun bx(a: FloatArray) = boxBlur(a, sw, sh, rs)
    fun prod(a: FloatArray, b: FloatArray) = FloatArray(a.size) { a[it] * b[it] }
    val mr = bx(ir); val mg = bx(ig); val mb = bx(ib); val mp = bx(ps)
    val mrp = bx(prod(ir, ps)); val mgp = bx(prod(ig, ps)); val mbp = bx(prod(ib, ps))
    val vrr = bx(prod(ir, ir)); val vrg = bx(prod(ir, ig)); val vrb = bx(prod(ir, ib))
    val vgg = bx(prod(ig, ig)); val vgb = bx(prod(ig, ib)); val vbb = bx(prod(ib, ib))
    val m = sw * sh
    val ar = FloatArray(m); val ag = FloatArray(m); val ab = FloatArray(m); val bb = FloatArray(m)
    for (i in 0 until m) {
      val c1 = mrp[i] - mr[i] * mp[i]; val c2 = mgp[i] - mg[i] * mp[i]; val c3 = mbp[i] - mb[i] * mp[i]
      val a11 = vrr[i] - mr[i] * mr[i] + eps; val a12 = vrg[i] - mr[i] * mg[i]; val a13 = vrb[i] - mr[i] * mb[i]
      val a22 = vgg[i] - mg[i] * mg[i] + eps; val a23 = vgb[i] - mg[i] * mb[i]
      val a33 = vbb[i] - mb[i] * mb[i] + eps
      // Inverse of the symmetric 3x3 covariance (+ eps I) by cofactors
      val i11 = a22 * a33 - a23 * a23; val i12 = a13 * a23 - a12 * a33; val i13 = a12 * a23 - a13 * a22
      val i22 = a11 * a33 - a13 * a13; val i23 = a12 * a13 - a11 * a23; val i33 = a11 * a22 - a12 * a12
      val det = a11 * i11 + a12 * i12 + a13 * i13
      if (det > 1e-12f) {
        val inv = 1f / det
        ar[i] = (i11 * c1 + i12 * c2 + i13 * c3) * inv
        ag[i] = (i12 * c1 + i22 * c2 + i23 * c3) * inv
        ab[i] = (i13 * c1 + i23 * c2 + i33 * c3) * inv
      }
      bb[i] = mp[i] - ar[i] * mr[i] - ag[i] * mg[i] - ab[i] * mb[i]
    }
    val gar = ColourGrid(sw, sh, s, bx(ar), bx(ag), bx(ab), bx(bb))
    val out = FloatArray(n)
    val c = FloatArray(4)
    for (y in 0 until h) {
      for (x in 0 until w) {
        val i = y * w + x
        gar.at(x, y, c)
        out[i] = (c[0] * cr[i] + c[1] * cg[i] + c[2] * cb[i] + c[3]).coerceIn(0f, 1f)
      }
    }
    return out
  }

  /** True when (x, y) is inside one of the head boxes ([l, t, r, b] quads, already expanded). */
  private fun inHead(heads: IntArray?, x: Int, y: Int): Boolean {
    if (heads == null) return false
    var j = 0
    while (j + 3 < heads.size) {
      if (x >= heads[j] && y >= heads[j + 1] && x < heads[j + 2] && y < heads[j + 3]) return true
      j += 4
    }
    return false
  }

  /**
   * ML Kit foreground confidence (0..1, full size) -> final soft alpha (0..1, full size). One mask
   * for Blur and Remove BG.
   *  1. Shape: confidence >= 0.35 (0.15 around faces: ears, glasses, hair), only the main pieces
   *     (specks dropped), small gaps filled, closed (no bitten notches), dilated ~3 px (sleeves and
   *     dress edges not eroded). Its inner core (~3 px inside the model's edge) is always 1.
   *  2. Edge: the model's SOFT confidence near that shape (not a hard 0/1 cut) is refined with a
   *     colour guided filter (radius ~8 px, eps 1e-3 at 2048 px) so the outline follows the real
   *     skin / hair / cloth edge in the photo, smooth, never a staircase.
   *  3. Light ~2 px feather; nothing survives > ~10 px outside the shape (no floating specks).
   * [heads]: face boxes in pixels as [l, t, r, b] quads (already widened to cover ears), or null.
   */
  fun refineAlpha(px: IntArray, conf: FloatArray, w: Int, h: Int, heads: IntArray? = null): FloatArray {
    val k = scaleFor(w, h)
    val n = w * h
    val keep = FloatArray(n)
    val soft = FloatArray(n)
    for (y in 0 until h) {
      for (x in 0 until w) {
        val i = y * w + x
        val c = conf[i]
        if (inHead(heads, x, y)) {
          keep[i] = if (c >= HEAD_THRESHOLD) 1f else 0f
          soft[i] = smoothstep(0.03f, 0.3f, c)
        } else {
          keep[i] = if (c >= KEEP_THRESHOLD) 1f else 0f
          soft[i] = smoothstep(0.1f, 0.5f, c)
        }
      }
    }
    keepMainPieces(keep, w, h)
    fillHoles(keep, w, h, (n * MAX_HOLE_SHARE).toInt())
    val rc = max(2, (6 * k).roundToInt())
    val closed = minFilter(maxFilter(keep, w, h, rc), w, h, rc)
    val shape = maxFilter(closed, w, h, max(1, (3 * k).roundToInt()))
    val core = minFilter(shape, w, h, max(2, (6 * k).roundToInt()))
    val band = maxFilter(shape, w, h, max(3, (10 * k).roundToInt()))
    val near = boxBlur(maxFilter(shape, w, h, max(2, (4 * k).roundToInt())), w, h, max(1, (2 * k).roundToInt()))
    val p = FloatArray(n)
    for (i in 0 until n) p[i] = max(soft[i] * near[i], shape[i]) * band[i]
    val r = max(2, (8 * k).roundToInt())
    val q = guidedFilter(px, p, w, h, r, 1e-3f, max(1, r / 2))
    val bandSoft = boxBlur(band, w, h, max(1, (2 * k).roundToInt()))
    for (i in 0 until n) q[i] = max(q[i], core[i]) * bandSoft[i]
    val f = max(1, (1.5f * k).roundToInt())
    val out = boxBlur(boxBlur(q, w, h, f), w, h, f)
    for (i in 0 until n) {
      var a = max(out[i], core[i])
      if (a < 0.02f) a = 0f else if (a > 0.98f) a = 1f
      out[i] = a
    }
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
  fun process(px: IntArray, conf: FloatArray, w: Int, h: Int, mode: String, level: Int, heads: IntArray? = null): IntArray? {
    val alpha = refineAlpha(px, conf, w, h, heads)
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

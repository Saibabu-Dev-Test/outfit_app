package com.outfit

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Pure maths for PhotoBackgroundModule (no Android classes, so it is unit tested on the JVM:
 * android/app/src/test/java/com/outfit/SegmentMathTest.kt).
 *
 * Pixels are ARGB ints (android.graphics.Color layout), masks are FloatArrays (0..1).
 * Fast and tight (target < 1 s on a mid-range phone, no halo):
 *  - the model runs on a small copy (long edge <= MASK_EDGE, the photo box-averaged by s);
 *  - lowResAlpha: confidence -> soft alpha on that grid, NO dilation, ramp centred on 0.5, wide
 *    moderately-sure loose clothing kept, specks dropped, holes filled;
 *  - alphaField: fast guided filter, coefficients on the small grid, applied to the full-size
 *    colours, so the outline snaps to the real edge of the 2048 px photo, ~1 px transition;
 *  - process: one pass over the full photo: alpha, edge colour decontamination, new background.
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
    for (y in 0 until h) {
      val row = y * w
      for (k in max(0, y - r)..min(h - 1, y + r)) {
        val kr = k * w
        for (x in 0 until w) { val v = tmp[kr + x]; if (v > out[row + x]) out[row + x] = v }
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
    // Vertical pass row by row (running column sums: memory order, cache friendly)
    val out = FloatArray(src.size)
    val sum = DoubleArray(w)
    var cnt = 0
    for (k in 0..min(h - 1, r)) { val row = k * w; for (x in 0 until w) sum[x] += tmp[row + x]; cnt++ }
    for (y in 0 until h) {
      val row = y * w
      val inv = 1.0 / cnt
      for (x in 0 until w) out[row + x] = (sum[x] * inv).toFloat()
      val add = y + r + 1
      val rem = y - r
      if (add < h) { val ar = add * w; for (x in 0 until w) sum[x] += tmp[ar + x]; cnt++ }
      if (rem >= 0) { val rr = rem * w; for (x in 0 until w) sum[x] -= tmp[rr + x]; cnt-- }
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

  /** Above this confidence a mask pixel is subject (the alpha ramp is centred here: no halo). */
  const val KEEP_THRESHOLD = 0.5f

  /** Around detected faces (ears, glasses temples, hair) the model is less sure: lower bar there. */
  const val HEAD_THRESHOLD = 0.35f

  /**
   * Loose clothing the model is only 0.3-0.5 sure about (saree pallu, dupatta, flared hem,
   * sleeves) is kept when it is a WIDE region joined to the sure subject. The thin 0.3-0.5 rim
   * every edge has (the old background) is not kept, so there is no halo.
   */
  const val WEAK_THRESHOLD = 0.3f
  const val HEAD_WEAK_THRESHOLD = 0.2f

  /** Enclosed gaps in the subject up to this share of the photo are filled (missed folds / pleats). */
  const val MAX_HOLE_SHARE = 0.004f

  /** Separate foreground pieces smaller than this share of the biggest one are dropped (specks). */
  const val MIN_PIECE_OF_LARGEST = 0.15f

  /** Long edge the segmentation runs at (the mask is ~3x smaller than the 2048 px photo: fast). */
  const val MASK_EDGE = 768

  /** Integer downscale factor so the mask's long edge is <= MASK_EDGE. */
  fun maskScale(w: Int, h: Int): Int = max(1, (max(w, h) + MASK_EDGE - 1) / MASK_EDGE)

  /** Box-average downscale of ARGB pixels by s (size ceil(w / s) x ceil(h / s)), opaque. */
  fun downsampleArgb(px: IntArray, w: Int, h: Int, s: Int): IntArray {
    if (s <= 1) return px.copyOf()
    val sw = (w + s - 1) / s
    val sh = (h + s - 1) / s
    val sr = IntArray(sw * sh); val sg = IntArray(sw * sh); val sb = IntArray(sw * sh); val cnt = IntArray(sw * sh)
    for (y in 0 until h) {
      val sy = (y / s) * sw
      val row = y * w
      for (x in 0 until w) {
        val c = sy + x / s
        val p = px[row + x]
        sr[c] += (p shr 16) and 0xFF; sg[c] += (p shr 8) and 0xFF; sb[c] += p and 0xFF
        cnt[c]++
      }
    }
    return IntArray(sw * sh) { i ->
      val n = max(1, cnt[i])
      (0xFF shl 24) or ((sr[i] / n) shl 16) or ((sg[i] / n) shl 8) or (sb[i] / n)
    }
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
   * Mask-resolution soft alpha (0..1, sw x sh) from the model's confidence. No dilation: the edge
   * ramp is smoothstep(0.4, 0.6) around 0.5 (0.25..0.45 in head boxes), so the 0.1-0.4 rim of old
   * background around the person is dropped. Wide, moderately sure regions joined to the subject
   * (loose clothes) are kept whole; specks dropped; small holes filled.
   */
  fun lowResAlpha(conf: FloatArray, sw: Int, sh: Int, heads: IntArray? = null): FloatArray {
    val n = sw * sh
    val strong = FloatArray(n)
    val weakOk = BooleanArray(n)
    val soft = FloatArray(n)
    for (y in 0 until sh) for (x in 0 until sw) {
      val i = y * sw + x
      val c = conf[i]
      if (inHead(heads, x, y)) {
        strong[i] = if (c >= HEAD_THRESHOLD) 1f else 0f
        weakOk[i] = c >= HEAD_WEAK_THRESHOLD
        soft[i] = smoothstep(0.25f, 0.45f, c)
      } else {
        strong[i] = if (c >= KEEP_THRESHOLD) 1f else 0f
        weakOk[i] = c >= WEAK_THRESHOLD
        soft[i] = smoothstep(0.4f, 0.6f, c)
      }
    }
    // Hysteresis: weak pixels connected to the sure subject
    val reach = BooleanArray(n)
    val q = IntArray(n)
    var tail = 0
    for (i in 0 until n) if (strong[i] >= 0.5f) { reach[i] = true; q[tail++] = i }
    var head = 0
    while (head < tail) {
      val i = q[head++]
      val x = i % sw
      if (x > 0 && !reach[i - 1] && weakOk[i - 1]) { reach[i - 1] = true; q[tail++] = i - 1 }
      if (x < sw - 1 && !reach[i + 1] && weakOk[i + 1]) { reach[i + 1] = true; q[tail++] = i + 1 }
      if (i >= sw && !reach[i - sw] && weakOk[i - sw]) { reach[i - sw] = true; q[tail++] = i - sw }
      if (i < n - sw && !reach[i + sw] && weakOk[i + sw]) { reach[i + sw] = true; q[tail++] = i + sw }
    }
    // Weak pixels far (> 2 cells) from the sure subject are a real region (loose cloth), not the
    // thin edge rim; grown back by 2 cells inside the reached area so they join the body
    val nearStrong = maxFilter(strong, sw, sh, 2)
    val weakFar = FloatArray(n)
    for (i in 0 until n) if (reach[i] && strong[i] < 0.5f && nearStrong[i] < 0.5f) weakFar[i] = 1f
    val weakSub = maxFilter(weakFar, sw, sh, 2)
    val keep = FloatArray(n)
    for (i in 0 until n) {
      if (reach[i] && weakSub[i] >= 0.5f) weakSub[i] = 1f else weakSub[i] = 0f
      keep[i] = if (strong[i] >= 0.5f || weakSub[i] >= 0.5f) 1f else 0f
    }
    val before = keep.copyOf()
    keepMainPieces(keep, sw, sh)
    fillHoles(keep, sw, sh, (n * MAX_HOLE_SHARE).toInt())
    val allowed = maxFilter(keep, sw, sh, 1)
    val p = FloatArray(n)
    for (i in 0 until n) {
      p[i] = when {
        keep[i] >= 0.5f && (before[i] < 0.5f || weakSub[i] >= 0.5f) -> 1f // filled gap / loose cloth
        before[i] >= 0.5f && keep[i] < 0.5f -> 0f // dropped speck
        else -> soft[i] * allowed[i]
      }
    }
    return p
  }

  /**
   * Fast guided filter (He & Sun 2015): the coefficients of a colour guided filter are solved on
   * the mask grid (photo box-averaged by s, radius [r] cells), smoothed, upsampled bilinearly and
   * applied to every FULL-size pixel's colour: q = a . I + b. The edge snaps to the real
   * hair / skin / cloth edge of the full photo at the cost of one pass over it.
   * Returns the coefficient grid (r, g, b = a, wt = b) addressed in full-size pixels.
   */
  fun guidedCoefficients(lowPx: IntArray, p: FloatArray, sw: Int, sh: Int, s: Int, r: Int, eps: Float): ColourGrid {
    val m = sw * sh
    val ir = FloatArray(m); val ig = FloatArray(m); val ib = FloatArray(m)
    for (i in 0 until m) {
      val v = lowPx[i]
      ir[i] = ((v shr 16) and 0xFF) / 255f; ig[i] = ((v shr 8) and 0xFF) / 255f; ib[i] = (v and 0xFF) / 255f
    }
    fun bx(a: FloatArray) = boxBlur(a, sw, sh, r)
    fun prod(a: FloatArray, b: FloatArray) = FloatArray(m) { a[it] * b[it] }
    val mr = bx(ir); val mg = bx(ig); val mb = bx(ib); val mp = bx(p)
    val mrp = bx(prod(ir, p)); val mgp = bx(prod(ig, p)); val mbp = bx(prod(ib, p))
    val vrr = bx(prod(ir, ir)); val vrg = bx(prod(ir, ig)); val vrb = bx(prod(ir, ib))
    val vgg = bx(prod(ig, ig)); val vgb = bx(prod(ig, ib)); val vbb = bx(prod(ib, ib))
    val ar = FloatArray(m); val ag = FloatArray(m); val ab = FloatArray(m); val bb = FloatArray(m)
    for (i in 0 until m) {
      val c1 = mrp[i] - mr[i] * mp[i]; val c2 = mgp[i] - mg[i] * mp[i]; val c3 = mbp[i] - mb[i] * mp[i]
      val a11 = vrr[i] - mr[i] * mr[i] + eps; val a12 = vrg[i] - mr[i] * mg[i]; val a13 = vrb[i] - mr[i] * mb[i]
      val a22 = vgg[i] - mg[i] * mg[i] + eps; val a23 = vgb[i] - mg[i] * mb[i]
      val a33 = vbb[i] - mb[i] * mb[i] + eps
      val i11 = a22 * a33 - a23 * a23; val i12 = a13 * a23 - a12 * a33; val i13 = a12 * a23 - a13 * a22
      val i22 = a11 * a33 - a13 * a13; val i23 = a12 * a13 - a11 * a23; val i33 = a11 * a22 - a12 * a12
      val det = a11 * i11 + a12 * i12 + a13 * i13
      if (det > 1e-15f) {
        val inv = 1f / det
        ar[i] = (i11 * c1 + i12 * c2 + i13 * c3) * inv
        ag[i] = (i12 * c1 + i22 * c2 + i23 * c3) * inv
        ab[i] = (i13 * c1 + i23 * c2 + i33 * c3) * inv
      }
      bb[i] = mp[i] - ar[i] * mr[i] - ag[i] * mg[i] - ab[i] * mb[i]
    }
    return ColourGrid(sw, sh, s, bx(ar), bx(ag), bx(ab), bx(bb))
  }

  /**
   * Per-photo alpha state, looked up per full-size pixel: guided coefficients, sure-inside /
   * may-be-subject limits, and the local sure-subject / sure-background colours. Where those two
   * colours differ clearly, the pixel's own colour says how much of it is subject (its position
   * between the two), which pulls an edge the model put a few px too far out back onto the real
   * outline (no ring of old background).
   */
  class AlphaField(val coef: ColourGrid, val limits: ColourGrid, val fg: ColourGrid?, val bg: ColourGrid?) {
    private val c = FloatArray(4)
    private val l = FloatArray(4)
    private val f = FloatArray(4)
    private val b = FloatArray(4)
    /** Same field with its own scratch space (one per worker thread). */
    fun copy(): AlphaField = AlphaField(coef, limits, fg, bg)
    /** Final alpha (0..1) of the full-size pixel (x, y) with colour [p]. */
    fun alpha(x: Int, y: Int, p: Int): Float {
      limits.at(x, y, l)
      val band = l[1]
      if (band <= 0.001f) return 0f
      val core = l[0]
      if (core >= 0.999f) return 1f
      val pr = ((p shr 16) and 0xFF) / 255f
      val pg = ((p shr 8) and 0xFF) / 255f
      val pb = (p and 0xFF) / 255f
      coef.at(x, y, c)
      var q = (c[0] * pr + c[1] * pg + c[2] * pb + c[3]).coerceIn(0f, 1f)
      if (fg != null && bg != null) {
        fg.at(x, y, f)
        bg.at(x, y, b)
        val dr = (f[0] - b[0]) / 255f; val dg = (f[1] - b[1]) / 255f; val db = (f[2] - b[2]) / 255f
        val d2 = dr * dr + dg * dg + db * db
        val trust = 0.6f * smoothstep(0.01f, 0.06f, d2) * smoothstep(0.05f, 0.3f, f[3]) * smoothstep(0.05f, 0.3f, b[3])
        if (trust > 0f) {
          val ca = (((pr - b[0] / 255f) * dr + (pg - b[1] / 255f) * dg + (pb - b[2] / 255f) * db) / d2).coerceIn(0f, 1f)
          q = q * (1 - trust) + ca * trust
        }
      }
      // Tighten the transition to ~1 px (no smeared edge), then keep it within the mask's limits
      var a = smoothstep(0.2f, 0.8f, q)
      a = max(a, smoothstep(0.5f, 1f, core)) * smoothstep(0f, 0.5f, band)
      return if (a < 0.02f) 0f else if (a > 0.98f) 1f else a
    }
  }

  /**
   * Builds the AlphaField from the mask-resolution alpha [pLow] (sw x sh) and the box-averaged
   * photo [lowPx] (same grid, cell s px of the full photo).
   */
  fun alphaField(lowPx: IntArray, pLow: FloatArray, sw: Int, sh: Int, s: Int, w: Int, h: Int): AlphaField {
    val k = scaleFor(w, h)
    val rFull = max(3, (6 * k).roundToInt())
    val r = max(1, (rFull.toFloat() / s).roundToInt())
    val coef = guidedCoefficients(lowPx, pLow, sw, sh, s, r, 4e-4f)
    val m = sw * sh
    val sure = FloatArray(m) { if (pLow[it] >= 0.99f) 1f else 0f }
    val any = FloatArray(m) { if (pLow[it] > 0.01f) 1f else 0f }
    val core = minFilter(sure, sw, sh, 1)
    val band = maxFilter(any, sw, sh, 1)
    val fgW = FloatArray(m) { if (pLow[it] >= 0.99f) 1f else 0f }
    val bgW = FloatArray(m) { if (pLow[it] <= 0.01f) 1f else 0f }
    val fg = weightedMeanGrid(lowPx, fgW, sw, sh, 3, 2).scaled(s)
    val bg = weightedMeanGrid(lowPx, bgW, sw, sh, 3, 2).scaled(s)
    return AlphaField(coef, ColourGrid(sw, sh, s, core, band, core, band), fg, bg)
  }

  /**
   * Model confidence [conf] (mask grid: ceil(w / s) x ceil(h / s)) -> final soft alpha at the
   * full size w x h. Used by the tests; process() evaluates the same field pixel by pixel.
   */
  fun refineAlpha(px: IntArray, conf: FloatArray, w: Int, h: Int, heads: IntArray? = null, s: Int = 1): FloatArray {
    val sw = (w + s - 1) / s
    val sh = (h + s - 1) / s
    val lowPx = downsampleArgb(px, w, h, s)
    val field = alphaField(lowPx, lowResAlpha(conf, sw, sh, heads), sw, sh, s, w, h)
    val out = FloatArray(w * h)
    for (y in 0 until h) for (x in 0 until w) { val i = y * w + x; out[i] = field.alpha(x, y, px[i]) }
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

    /** The same grid built on a photo shrunk by f, addressed in pixels of the f-times larger photo. */
    fun scaled(f: Int): ColourGrid = ColourGrid(sw, sh, s * f, r, g, b, wt)
  }

  /**
   * Normalised convolution: the mean colour around each pixel counting every pixel with its
   * weight (0..1), blurred ~Gaussian with sigma ~[radius] px. Where (almost) no weight is near,
   * the plain local mean is used. wt = local mean weight (how much the colour can be trusted).
   */
  fun weightedMeanGrid(px: IntArray, weight: FloatArray, w: Int, h: Int, radius: Int, minCell: Int = 1): ColourGrid {
    val s = max(minCell, radius / 4).coerceIn(1, 8)
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
   * Whole pipeline. [px]: the full-size photo (w x h); [conf]: the model's confidence on the mask
   * grid (photo box-averaged by [s]: ceil(w / s) x ceil(h / s)); [lowPx]: that averaged photo when
   * the caller already has it. mode "blur" (level 1..5) or "plain" (solid black behind light
   * clothes, white behind dark ones). Every heavy step runs on the small grid; the full-size photo
   * is read once and written once. Edge pixels get their colour decontaminated: the old
   * background is un-mixed out (F = (I - (1 - a) B) / a) and, where the subject is thin / unsure,
   * pulled towards the nearby sure subject colour, so no grey / old-background fringe is left.
   * Null when there is no clear subject (keep the photo).
   */
  fun process(
    px: IntArray, conf: FloatArray, w: Int, h: Int, mode: String, level: Int,
    heads: IntArray? = null, s: Int = 1, lowPx: IntArray? = null,
  ): IntArray? {
    val sw = (w + s - 1) / s
    val sh = (h + s - 1) / s
    val m = sw * sh
    val low = lowPx ?: downsampleArgb(px, w, h, s)
    val pLow = lowResAlpha(conf, sw, sh, heads)
    val share = subjectShare(pLow)
    if (share < 0.02f || share > 0.98f) return null
    val field = alphaField(low, pLow, sw, sh, s, w, h)
    val bgW = FloatArray(m) { 1f - pLow[it] }
    val oldBg = weightedMeanGrid(low, bgW, sw, sh, 2).scaled(s)
    val fgMean = field.fg!!
    val blur = mode == "blur"
    val blurGrid = if (blur) weightedMeanGrid(low, bgW, sw, sh, max(1, (blurRadius(level, w, h).toFloat() / s).roundToInt()), 2).scaled(s) else null
    val solid = if (subjectLuminance(low, pLow) >= 140.0) 0xFF000000.toInt() else 0xFFFFFFFF.toInt()
    val dim = 0.9f
    val out = IntArray(w * h)
    // The one full-size pass, split into row bands over a few cores
    val workers = max(1, min(4, Runtime.getRuntime().availableProcessors()))
    val band = (h + workers - 1) / workers
    val jobs = (0 until workers).map { k ->
      Thread {
        val fieldK = field.copy()
        val nb = FloatArray(4); val ob = FloatArray(4); val fm = FloatArray(4)
        for (y in k * band until min(h, (k + 1) * band)) {
          for (x in 0 until w) {
            val i = y * w + x
            val p = px[i]
            val a = fieldK.alpha(x, y, p)
            if (a >= 1f) { out[i] = p or (0xFF shl 24); continue }
            val nr: Float; val ng: Float; val nbl: Float
            if (blurGrid != null) {
              blurGrid.at(x, y, nb)
              nr = nb[0] * dim; ng = nb[1] * dim; nbl = nb[2] * dim
            } else {
              nr = ((solid shr 16) and 0xFF).toFloat(); ng = ((solid shr 8) and 0xFF).toFloat(); nbl = (solid and 0xFF).toFloat()
            }
            if (a <= 0f) {
              out[i] = (0xFF shl 24) or (nr.roundToInt().coerceIn(0, 255) shl 16) or (ng.roundToInt().coerceIn(0, 255) shl 8) or nbl.roundToInt().coerceIn(0, 255)
              continue
            }
            oldBg.at(x, y, ob)
            fgMean.at(x, y, fm)
            val ia = 1f / max(a, 0.25f)
            val ib = 1f - a
            var r = ((((p shr 16) and 0xFF) - ib * ob[0]) * ia).coerceIn(0f, 255f)
            var g = ((((p shr 8) and 0xFF) - ib * ob[1]) * ia).coerceIn(0f, 255f)
            var b = (((p and 0xFF) - ib * ob[2]) * ia).coerceIn(0f, 255f)
            // Unsure / thin edge pixels: pull towards the nearby sure subject colour
            val t = if (fm[3] < 0.01f) 1f else smoothstep(0.1f, 0.7f, a)
            r = r * t + fm[0] * (1 - t); g = g * t + fm[1] * (1 - t); b = b * t + fm[2] * (1 - t)
            val rr = (r * a + nr * ib).roundToInt().coerceIn(0, 255)
            val gg = (g * a + ng * ib).roundToInt().coerceIn(0, 255)
            val bb = (b * a + nbl * ib).roundToInt().coerceIn(0, 255)
            out[i] = (0xFF shl 24) or (rr shl 16) or (gg shl 8) or bb
          }
        }
      }.apply { start() }
    }
    jobs.forEach { it.join() }
    return out
  }
}

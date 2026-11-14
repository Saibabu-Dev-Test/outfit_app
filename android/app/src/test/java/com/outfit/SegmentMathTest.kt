package com.outfit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.hypot
import kotlin.math.max

// JVM tests for SegmentMath (photo background: Blur / Remove BG). Run: ./gradlew :app:testDebugUnitTest
class SegmentMathTest {
  // The real working size: 2048 x 1536 photo, model mask on a 3x smaller grid (683 x 512)
  private val w = 2048
  private val h = 1536
  private val s = SegmentMath.maskScale(w, h)
  private val sw = (w + s - 1) / s
  private val sh = (h + s - 1) / s
  private val cx = 1024.0
  private val cy = 768.0
  private val rad = 500.0

  private fun rgb(r: Int, g: Int, b: Int) = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
  private fun red(p: Int) = (p shr 16) and 0xFF
  private fun green(p: Int) = (p shr 8) and 0xFF
  private fun blue(p: Int) = p and 0xFF
  private fun dist(x: Int, y: Int) = hypot(x + 0.5 - cx, y + 0.5 - cy)
  private fun cellDist(x: Int, y: Int) = hypot((x + 0.5) * s - cx, (y + 0.5) * s - cy)

  // A red disc (the "person") on a background with a little texture
  private fun photo(bg: (Int, Int) -> Int = { x, y -> rgb(20, 40, 200 + ((x * 7 + y * 13) % 30)) }): IntArray =
    IntArray(w * h) { i ->
      val x = i % w
      val y = i / w
      if (dist(x, y) <= rad) rgb(220, 30, 30) else bg(x, y)
    }

  /**
   * A model-like mask on the small grid: 0.5 at [edge] px from the centre, a soft fall-off ~10 px
   * wide on either side (the low-confidence rim of old background that made the halo).
   */
  private fun mask(edge: Double = rad): FloatArray = FloatArray(sw * sh) { i ->
    val d = cellDist(i % sw, i / sw)
    (0.5 + (edge - d) / 20.0).coerceIn(0.02, 0.98).toFloat()
  }

  @Test fun smoothstepIsClampedAndMonotonic() {
    assertEquals(0f, SegmentMath.smoothstep(0.2f, 0.6f, 0.1f), 1e-6f)
    assertEquals(1f, SegmentMath.smoothstep(0.2f, 0.6f, 0.9f), 1e-6f)
    assertEquals(0.5f, SegmentMath.smoothstep(0.2f, 0.6f, 0.4f), 1e-6f)
  }

  @Test fun boxBlurKeepsConstantsAndMaxFilterDilates() {
    val c = FloatArray(30 * 20) { 0.4f }
    SegmentMath.boxBlur(c, 30, 20, 3).forEach { assertEquals(0.4f, it, 1e-5f) }
    val dot = FloatArray(11 * 11).also { it[5 * 11 + 5] = 1f }
    val d = SegmentMath.maxFilter(dot, 11, 11, 2)
    assertEquals(1f, d[3 * 11 + 3], 0f)
    assertEquals(1f, d[7 * 11 + 7], 0f)
    assertEquals(0f, d[2 * 11 + 5], 0f)
  }

  @Test fun downUpSampleKeepsConstants() {
    val c = FloatArray(37 * 23) { 0.7f }
    val sm = SegmentMath.downsample(c, 37, 23, 4)
    SegmentMath.upsample(sm, 37, 23, 4).forEach { assertEquals(0.7f, it, 1e-5f) }
    val px = IntArray(37 * 23) { rgb(10, 20, 30) }
    SegmentMath.downsampleArgb(px, 37, 23, 3).forEach { assertEquals(rgb(10, 20, 30), it) }
  }

  @Test fun maskRunsOnASmallCopy() {
    assertEquals(3, SegmentMath.maskScale(2048, 1536))
    assertTrue(max(sw, sh) <= SegmentMath.MASK_EDGE)
    assertEquals(1, SegmentMath.maskScale(600, 400))
  }

  @Test fun edgeIsTightNoHaloAndNothingEaten() {
    val px = photo()
    val alpha = SegmentMath.refineAlpha(px, mask(), w, h, null, s)
    var inside = 0; var insideMiss = 0; var outside = 0; var halo = 0
    for (y in 0 until h) for (x in 0 until w) {
      val d = dist(x, y)
      val a = alpha[y * w + x]
      if (d <= rad - 2) { inside++; if (a < 0.9f) insideMiss++ }
      if (d >= rad + 2) { outside++; if (a > 0.1f) halo++ }
    }
    assertTrue("subject edge eaten: $insideMiss of $inside", insideMiss < inside * 0.002)
    assertTrue("halo: $halo of $outside", halo < outside * 0.002)
  }

  @Test fun aSlightlyGenerousMaskStillSnapsToTheRealEdge() {
    // The model's 0.5 line sits 4 px outside the person (typical on a 3x smaller mask)
    val px = photo()
    val alpha = SegmentMath.refineAlpha(px, mask(rad + 4), w, h, null, s)
    var ring = 0; var ringHalo = 0
    for (y in 0 until h) for (x in 0 until w) {
      val d = dist(x, y)
      if (d >= rad + 2 && d <= rad + 30) { ring++; if (alpha[y * w + x] > 0.1f) ringHalo++ }
    }
    assertTrue("halo ring: $ringHalo of $ring", ringHalo < ring * 0.01)
  }

  @Test fun removeBgOnGreyWallHasNoGreyFringe() {
    // Grey wall (the user's case): no grey band around the person after Remove BG
    val px = photo { _, _ -> rgb(128, 128, 128) }
    val out = SegmentMath.process(px, mask(rad + 3), w, h, "plain", 3, null, s)!!
    var bad = 0; var n = 0
    for (y in 0 until h step 2) for (x in 0 until w step 2) {
      val d = dist(x, y)
      val p = out[y * w + x]
      if (d >= rad + 2) { n++; if (red(p) < 235 || green(p) < 235 || blue(p) < 235) bad++ }
      if (d <= rad - 2) assertTrue("subject greyed at $x,$y: ${red(p)},${green(p)},${blue(p)}", red(p) > 200 && green(p) < 60)
    }
    assertTrue("grey fringe: $bad of $n", bad < n * 0.002)
  }

  @Test fun patternedClothesNearTheEdgeAreNotHoled() {
    // Red / dark-blue striped dress on a blue wall: dark stripes look like the wall but stay
    val px = photo()
    for (y in 0 until h) for (x in 0 until w) if (dist(x, y) <= rad && (x / 6) % 2 == 0) px[y * w + x] = rgb(25, 40, 160)
    val alpha = SegmentMath.refineAlpha(px, mask(), w, h, null, s)
    var inside = 0; var holes = 0
    for (y in 0 until h) for (x in 0 until w) if (dist(x, y) <= rad - 2) { inside++; if (alpha[y * w + x] < 0.5f) holes++ }
    assertTrue("holes in patterned dress: $holes of $inside", holes < inside * 0.003)
  }

  @Test fun lookalikeColoursFollowTheModel() {
    // Subject and background the same grey: no colour cue, the model's 0.5 line is used
    val px = IntArray(w * h) { rgb(128, 128, 128) }
    val alpha = SegmentMath.refineAlpha(px, mask(), w, h, null, s)
    assertEquals(1f, alpha[cy.toInt() * w + (cx + rad - 8).toInt()], 0.02f)
    assertEquals(1f, alpha[cy.toInt() * w + cx.toInt()], 0f)
    assertEquals(0f, alpha[cy.toInt() * w + (cx + rad + 10).toInt()], 0.02f)
    assertEquals(0f, alpha[10 * w + 10], 0f)
  }

  @Test fun looseDressTheModelIsUnsureAboutIsKept() {
    // Body (disc, model sure) + a wide "saree / skirt" below it the model is only 0.4 sure about
    val sx0 = 700; val sx1 = 1350; val sy0 = 1150; val sy1 = 1500
    fun inSkirt(x: Int, y: Int) = x in sx0 until sx1 && y in sy0 until sy1
    val px = IntArray(w * h) { i ->
      val x = i % w; val y = i / w
      when {
        dist(x, y) <= rad -> rgb(220, 30, 30)
        inSkirt(x, y) -> rgb(40, 150, 60)
        else -> rgb(60, 140, 110)
      }
    }
    val m = mask()
    for (y in 0 until sh) for (x in 0 until sw) if (inSkirt(x * s + 1, y * s + 1)) m[y * sw + x] = max(m[y * sw + x], 0.4f)
    val alpha = SegmentMath.refineAlpha(px, m, w, h, null, s)
    var miss = 0
    for (y in sy0 + 6 until sy1 - 6) for (x in sx0 + 6 until sx1 - 6) {
      if (kotlin.math.abs(dist(x, y) - rad) < 8) continue // where the body outline crosses the skirt
      if (alpha[y * w + x] < 0.99f) miss++
    }
    assertEquals("dress pixels cut", 0, miss)
    assertEquals(0f, alpha[20 * w + 20], 0f)
  }

  @Test fun thinLowConfidenceRimIsDropped() {
    // A 2-cell 0.4 rim of old background around the person (what made the halo) is not kept
    val px = photo()
    val m = FloatArray(sw * sh) { i ->
      val d = cellDist(i % sw, i / sw)
      when { d <= rad -> 0.95f; d <= rad + 2 * s -> 0.4f; else -> 0.02f }
    }
    val alpha = SegmentMath.refineAlpha(px, m, w, h, null, s)
    for (deg in 0 until 360 step 10) {
      val t = Math.toRadians(deg.toDouble())
      val x = (cx + (rad + 4) * Math.cos(t)).toInt()
      val y = (cy + (rad + 4) * Math.sin(t)).toInt()
      assertTrue("rim kept at $deg: ${alpha[y * w + x]}", alpha[y * w + x] < 0.1f)
    }
  }

  @Test fun floatingSpecksAreDroppedAndTheEdgeIsMonotonic() {
    val px = photo()
    val m = mask()
    val specks = listOf(intArrayOf(sw / 2 + 180, sh / 2), intArrayOf(sw / 2 - 182, sh / 2 + 10), intArrayOf(sw / 2, sh / 2 + 180))
    for (sp in specks) for (dy in -2..2) for (dx in -2..2) m[(sp[1] + dy) * sw + sp[0] + dx] = 0.8f
    val alpha = SegmentMath.refineAlpha(px, m, w, h, null, s)
    for (sp in specks) {
      val x = sp[0] * s + 1; val y = sp[1] * s + 1
      assertTrue("speck kept at $x,$y: ${alpha[y * w + x]}", alpha[y * w + x] < 0.05f)
    }
    var last = 1.01f
    for (x in (cx + rad - 20).toInt() until (cx + rad + 20).toInt()) {
      val a = alpha[cy.toInt() * w + x]
      assertTrue("non-monotonic edge at $x", a <= last + 0.02f)
      last = a
    }
  }

  @Test fun headBoxesKeepLowConfidenceEarsAndGlasses() {
    val ww = 600; val hh = 600; val r0 = 200.0
    fun d(x: Int, y: Int) = hypot(x + 0.5 - 300, y + 0.5 - 300)
    val px = IntArray(ww * hh) { i -> if (d(i % ww, i / ww) <= r0) rgb(220, 30, 30) else rgb(20, 40, 210) }
    val conf = FloatArray(ww * hh) { i -> if (d(i % ww, i / ww) <= r0) 0.95f else 0.02f }
    // An "ear" just outside the disc the model is only 0.4 sure about (and red like the face)
    for (y in 290 until 310) for (x in 500 until 512) { conf[y * ww + x] = 0.4f; px[y * ww + x] = rgb(220, 30, 30) }
    val without = SegmentMath.refineAlpha(px, conf, ww, hh)
    val with = SegmentMath.refineAlpha(px, conf, ww, hh, intArrayOf(50, 50, 550, 550))
    assertTrue("ear kept with head box: ${with[300 * ww + 506]}", with[300 * ww + 506] > 0.9f)
    assertTrue(with[300 * ww + 506] >= without[300 * ww + 506])
  }

  @Test fun smallGapsInsideTheSubjectAreFilledButLargeOnesStay() {
    val ww = 200; val hh = 200
    val keep = FloatArray(ww * hh) { i -> val x = i % ww; val y = i / ww; if (x in 20 until 180 && y in 20 until 180) 1f else 0f }
    for (y in 50 until 55) for (x in 50 until 55) keep[y * ww + x] = 0f
    for (y in 100 until 170) for (x in 100 until 170) keep[y * ww + x] = 0f
    SegmentMath.fillHoles(keep, ww, hh, 100)
    assertEquals(1f, keep[52 * ww + 52], 0f)
    assertEquals(0f, keep[130 * ww + 130], 0f)
    assertEquals(0f, keep[5 * ww + 5], 0f)
  }

  @Test fun backgroundBlurDoesNotSmearTheSubject() {
    val ww = 1000; val hh = 1000; val r0 = 300.0
    fun d(x: Int, y: Int) = hypot(x + 0.5 - 500, y + 0.5 - 500)
    val px = IntArray(ww * hh) { i -> if (d(i % ww, i / ww) <= r0) rgb(220, 30, 30) else rgb(20, 40, 210) }
    val alpha = FloatArray(ww * hh) { i -> if (d(i % ww, i / ww) <= r0) 1f else 0f }
    val bg = SegmentMath.backgroundBlur(px, alpha, ww, hh, 12, 1f)
    for (deg in 0 until 360 step 15) {
      val t = Math.toRadians(deg.toDouble())
      val x = (500 + (r0 + 3) * Math.cos(t)).toInt()
      val y = (500 + (r0 + 3) * Math.sin(t)).toInt()
      val p = bg[y * ww + x]
      assertTrue("red bleed ${red(p)} at $deg", red(p) < 40)
    }
  }

  @Test fun compositeRemovesTheOldBackgroundHalo() {
    val i = rgb(110, 0, 128)
    val out = SegmentMath.composite(intArrayOf(i), floatArrayOf(0.5f), intArrayOf(rgb(255, 255, 255)), intArrayOf(rgb(0, 0, 255)))[0]
    assertEquals(238f, red(out).toFloat(), 3f)
    assertEquals(128f, green(out).toFloat(), 3f)
    assertEquals(128f, blue(out).toFloat(), 3f)
    val p = rgb(1, 2, 3)
    assertEquals(p, SegmentMath.composite(intArrayOf(p), floatArrayOf(1f), intArrayOf(rgb(9, 9, 9)), null)[0])
  }

  @Test fun processBlurKeepsSubjectSharpAndIsFast() {
    val px = photo()
    val m = mask()
    SegmentMath.process(px, m, w, h, "blur", 3, null, s) // warm the JIT
    val t0 = System.nanoTime()
    val blur = SegmentMath.process(px, m, w, h, "blur", 3, null, s)
    val ms = (System.nanoTime() - t0) / 1_000_000
    println("process 2048x1536 blur: $ms ms (desktop JVM)")
    assertNotNull(blur)
    for (y in 0 until h step 3) for (x in 0 until w step 3) {
      val i = y * w + x
      // The outline is feathered (~6 px soft edge), everything further inside stays untouched
      if (dist(x, y) <= rad - 7) assertEquals("subject changed at $x,$y", px[i], blur!![i])
      if (dist(x, y) >= rad + 4) assertTrue("red glow at $x,$y", red(blur!![i]) < 60)
    }
  }

  @Test fun blurEdgeIsSoftNotAScissorCut() {
    val px = photo()
    val blur = SegmentMath.process(px, mask(), w, h, "blur", 3, null, s)!!
    // Across the outline there are several in-between pixels, not a 1 px jump
    var mid = 0
    val y = cy.toInt()
    for (x in (cx + rad - 10).toInt()..(cx + rad + 10).toInt()) { val r = red(blur[y * w + x]); if (r in 70..190) mid++ }
    assertTrue("hard edge: only $mid soft pixels", mid >= 3)
  }

  @Test fun gapTheModelSaysIsBackgroundIsNotFilled() {
    val ww = 200; val hh = 200
    val keep = FloatArray(ww * hh) { i -> val x = i % ww; val y = i / ww; if (x in 20 until 180 && y in 20 until 180) 1f else 0f }
    val conf = FloatArray(ww * hh) { keep[it] }
    for (y in 50 until 55) for (x in 50 until 55) { keep[y * ww + x] = 0f; conf[y * ww + x] = 0.35f } // missed fold
    for (y in 90 until 98) for (x in 90 until 98) { keep[y * ww + x] = 0f; conf[y * ww + x] = 0.02f } // arm-body gap
    SegmentMath.fillHoles(keep, ww, hh, 100, conf)
    assertEquals(1f, keep[52 * ww + 52], 0f)
    assertEquals(0f, keep[94 * ww + 94], 0f)
  }

  @Test fun noSubjectKeepsThePhoto() {
    val px = photo()
    assertNull(SegmentMath.process(px, FloatArray(sw * sh) { 0.01f }, w, h, "blur", 3, null, s))
    assertNull(SegmentMath.process(px, FloatArray(sw * sh) { 0.99f }, w, h, "plain", 3, null, s))
  }

  @Test fun blurRadiusGrowsWithLevelAndPhotoSize() {
    var last = 0
    for (lv in 1..5) { val r = SegmentMath.blurRadius(lv, 2048, 1536); assertTrue(r > last); last = r }
    assertTrue(SegmentMath.blurRadius(3, 1024, 768) < SegmentMath.blurRadius(3, 2048, 1536))
    assertTrue(max(1, SegmentMath.blurRadius(1, 50, 50)) >= 2)
  }
}

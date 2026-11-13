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
  // ~1/2 of a real photo (the module works at 2048 px), so the tuning radii are realistic
  private val w = 1000
  private val h = 1000
  private val cx = 500.0
  private val cy = 500.0
  private val rad = 300.0

  private fun rgb(r: Int, g: Int, b: Int) = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
  private fun red(p: Int) = (p shr 16) and 0xFF
  private fun green(p: Int) = (p shr 8) and 0xFF
  private fun blue(p: Int) = p and 0xFF
  private fun dist(x: Int, y: Int) = hypot(x + 0.5 - cx, y + 0.5 - cy)

  // A red disc (the "person") on a blue background with a little texture
  private fun photo(): IntArray = IntArray(w * h) { i ->
    val x = i % w
    val y = i / w
    if (dist(x, y) <= rad) rgb(220, 30, 30) else rgb(20, 40, 200 + ((x * 7 + y * 13) % 30))
  }

  // A poor ML mask: blocky (8 px cells), sure only well inside, 0.35 sure near the edge, and
  // missing the outer ~3 px of the subject
  private fun poorMask(): FloatArray = FloatArray(w * h) { i ->
    val x = (i % w) / 8 * 8 + 4
    val y = (i / w) / 8 * 8 + 4
    val d = hypot(x - cx, y - cy)
    when {
      d <= rad - 12 -> 0.97f
      d <= rad - 3 -> 0.35f
      else -> 0.02f
    }
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
    val s = SegmentMath.downsample(c, 37, 23, 4)
    SegmentMath.upsample(s, 37, 23, 4).forEach { assertEquals(0.7f, it, 1e-5f) }
  }

  @Test fun refinedAlphaFollowsTheRealOutline() {
    val px = photo()
    val alpha = SegmentMath.refineAlpha(px, poorMask(), w, h)
    var insideMiss = 0
    var inside = 0
    var outsideSpill = 0
    var outside = 0
    for (y in 0 until h) for (x in 0 until w) {
      val d = dist(x, y)
      val a = alpha[y * w + x]
      if (d <= rad - 3) { inside++; if (a < 0.9f) insideMiss++ }
      if (d >= rad + 5) { outside++; if (a > 0.15f) outsideSpill++ }
    }
    // The blocky, shrunk mask is snapped back to the disc's real round edge (smooth ~2-3 px feather)
    assertTrue("subject edge eaten: $insideMiss of $inside", insideMiss < inside * 0.01)
    assertTrue("background spill: $outsideSpill of $outside", outsideSpill < outside * 0.01)
  }

  @Test fun lookalikeColoursKeepTheModeratelySureMaskWhole() {
    // Subject and background the same grey: no colour cue; the 0.35-confidence band is kept whole
    val px = IntArray(w * h) { rgb(128, 128, 128) }
    val alpha = SegmentMath.refineAlpha(px, poorMask(), w, h)
    val i = (cy.toInt()) * w + (cx + rad - 8).toInt() // in the 0.35-confidence band
    assertEquals(1f, alpha[i], 0f)
    assertEquals(1f, alpha[cy.toInt() * w + cx.toInt()], 0f)
    assertEquals(0f, alpha[10 * w + 10], 0f)
  }

  @Test fun looseDressTheModelIsUnsureAboutIsKept() {
    // Body (red disc, model sure) + a wide green "saree / skirt" below it on a greenish wall that
    // the model is only 0.4 sure about. It used to be re-matted against the red body colour and cut.
    val sx0 = 250; val sx1 = 750; val sy0 = 700; val sy1 = 980
    fun inSkirt(x: Int, y: Int) = x in sx0 until sx1 && y in sy0 until sy1
    val px = IntArray(w * h) { i ->
      val x = i % w; val y = i / w
      when {
        dist(x, y) <= rad -> rgb(220, 30, 30)
        inSkirt(x, y) -> rgb(40, 150, 60)
        else -> rgb(60, 140, 110)
      }
    }
    val conf = FloatArray(w * h) { i ->
      val x = i % w; val y = i / w
      when {
        dist(x, y) <= rad - 3 -> 0.97f
        inSkirt(x, y) -> 0.4f
        else -> 0.02f
      }
    }
    val alpha = SegmentMath.refineAlpha(px, conf, w, h)
    var miss = 0
    for (y in sy0 + 3 until sy1 - 3) for (x in sx0 + 3 until sx1 - 3) if (alpha[y * w + x] < 0.99f) miss++
    assertEquals("dress pixels cut", 0, miss)
    assertEquals(0f, alpha[20 * w + 20], 0f)
  }

  @Test fun floatingSpecksAreDroppedAndTheEdgeIsSmooth() {
    val px = photo()
    // Good mask plus background specks the model half-believed, 5-20 px outside the outline
    val conf = FloatArray(w * h) { i -> if (dist(i % w, i / w) <= rad) 0.95f else 0.02f }
    val specks = listOf(intArrayOf(500 + 300 + 12, 500), intArrayOf(500 - 300 - 15, 520), intArrayOf(500, 500 + 300 + 18))
    for (sp in specks) for (dy in -2..2) for (dx in -2..2) conf[(sp[1] + dy) * w + sp[0] + dx] = 0.8f
    val alpha = SegmentMath.refineAlpha(px, conf, w, h)
    for (sp in specks) assertTrue("speck kept at ${sp[0]},${sp[1]}: ${alpha[sp[1] * w + sp[0]]}", alpha[sp[1] * w + sp[0]] < 0.05f)
    // Smooth: along a horizontal line through the edge alpha falls monotonically, no notches
    var last = 1.01f
    for (x in 500 + 280 until 500 + 320) {
      val a = alpha[500 * w + x]
      assertTrue("non-monotonic edge at $x", a <= last + 0.02f)
      last = a
    }
  }

  @Test fun headBoxesKeepLowConfidenceEarsAndGlasses() {
    val px = photo()
    val conf = FloatArray(w * h) { i -> if (dist(i % w, i / w) <= rad) 0.95f else 0.02f }
    // An "ear" just outside the disc that the model is only 0.2 sure about (and red like the face)
    for (y in 490 until 510) for (x in 800 until 812) { conf[y * w + x] = 0.2f; px[y * w + x] = rgb(220, 30, 30) }
    val without = SegmentMath.refineAlpha(px, conf, w, h)
    val with = SegmentMath.refineAlpha(px, conf, w, h, intArrayOf(150, 150, 850, 850))
    assertTrue("ear kept with head box: ${with[500 * w + 806]}", with[500 * w + 806] > 0.9f)
    assertTrue(with[500 * w + 806] >= without[500 * w + 806])
  }

  @Test fun smallGapsInsideTheSubjectAreFilledButLargeOnesStay() {
    val ww = 200; val hh = 200
    val keep = FloatArray(ww * hh) { i -> val x = i % ww; val y = i / ww; if (x in 20 until 180 && y in 20 until 180) 1f else 0f }
    for (y in 50 until 55) for (x in 50 until 55) keep[y * ww + x] = 0f // small fold the model missed
    for (y in 100 until 170) for (x in 100 until 170) keep[y * ww + x] = 0f // big real gap
    SegmentMath.fillHoles(keep, ww, hh, 100)
    assertEquals(1f, keep[52 * ww + 52], 0f)
    assertEquals(0f, keep[130 * ww + 130], 0f)
    assertEquals(0f, keep[5 * ww + 5], 0f)
  }

  @Test fun backgroundBlurDoesNotSmearTheSubject() {
    val px = photo()
    val alpha = FloatArray(w * h) { i -> if (dist(i % w, i / w) <= rad) 1f else 0f }
    val bg = SegmentMath.backgroundBlur(px, alpha, w, h, 12, 1f)
    // Right next to the red disc the blurred background is still blue (no red glow)
    for (deg in 0 until 360 step 15) {
      val t = Math.toRadians(deg.toDouble())
      val x = (cx + (rad + 3) * Math.cos(t)).toInt().coerceIn(0, w - 1)
      val y = (cy + (rad + 3) * Math.sin(t)).toInt().coerceIn(0, h - 1)
      val p = bg[y * w + x]
      assertTrue("red bleed ${red(p)} at $deg", red(p) < 40)
      assertTrue("blue lost ${blue(p)} at $deg", blue(p) > 170)
    }
  }

  @Test fun compositeRemovesTheOldBackgroundHalo() {
    // Edge pixel half subject (red), half old background (blue); new background white
    val i = rgb(110, 0, 128)
    val out = SegmentMath.composite(intArrayOf(i), floatArrayOf(0.5f), intArrayOf(rgb(255, 255, 255)), intArrayOf(rgb(0, 0, 255)))[0]
    assertEquals(238f, red(out).toFloat(), 3f) // 0.5 * 220 + 0.5 * 255
    assertEquals(128f, green(out).toFloat(), 3f)
    assertEquals(128f, blue(out).toFloat(), 3f) // no blue halo left
    // Opaque subject pixels are kept exactly (stay sharp)
    val p = rgb(1, 2, 3)
    assertEquals(p, SegmentMath.composite(intArrayOf(p), floatArrayOf(1f), intArrayOf(rgb(9, 9, 9)), null)[0])
  }

  @Test fun processBlurKeepsSubjectSharpAndRemoveBgIsClean() {
    val px = photo()
    val blur = SegmentMath.process(px, poorMask(), w, h, "blur", 3)
    assertNotNull(blur)
    val plain = SegmentMath.process(px, poorMask(), w, h, "plain", 3)!!
    for (y in 0 until h) for (x in 0 until w) {
      val d = dist(x, y)
      val i = y * w + x
      if (d <= rad - 5) assertEquals("subject changed at $x,$y", px[i], blur!![i])
      // Dark-ish red subject -> white background, no blue fringe outside the soft edge
      if (d >= rad + 6) {
        val p = plain[i]
        assertTrue("fringe at $x,$y: ${red(p)},${green(p)},${blue(p)}", red(p) > 235 && green(p) > 235 && blue(p) > 235)
      }
    }
  }

  @Test fun noSubjectKeepsThePhoto() {
    val px = photo()
    assertNull(SegmentMath.process(px, FloatArray(w * h) { 0.01f }, w, h, "blur", 3))
    assertNull(SegmentMath.process(px, FloatArray(w * h) { 0.99f }, w, h, "plain", 3))
  }

  @Test fun blurRadiusGrowsWithLevelAndPhotoSize() {
    var last = 0
    for (lv in 1..5) { val r = SegmentMath.blurRadius(lv, 2048, 1536); assertTrue(r > last); last = r }
    assertTrue(SegmentMath.blurRadius(3, 1024, 768) < SegmentMath.blurRadius(3, 2048, 1536))
    assertTrue(max(1, SegmentMath.blurRadius(1, 50, 50)) >= 2)
  }
}

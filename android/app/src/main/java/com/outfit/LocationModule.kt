package com.outfit

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Approximate location (ACCESS_COARSE_LOCATION) for "Nearby circles". Plain LocationManager:
// no Google Play Services location, no paid SDK. JS asks the runtime permission first.
// Resolves {lat, lng, accuracy} or rejects with NO_PERMISSION / LOCATION_OFF / NO_FIX.
class LocationModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  private fun hasPermission(): Boolean =
    ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

  private fun toMap(l: Location) = Arguments.createMap().apply {
    putDouble("lat", l.latitude)
    putDouble("lng", l.longitude)
    putDouble("accuracy", l.accuracy.toDouble())
  }

  @ReactMethod
  fun getApproxLocation(promise: Promise) {
    if (!hasPermission()) {
      promise.reject("NO_PERMISSION", "Location permission not granted")
      return
    }
    val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    if (lm == null) {
      promise.reject("NO_FIX", "No location service")
      return
    }
    try {
      val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.PASSIVE_PROVIDER)
        .filter { p -> try { lm.isProviderEnabled(p) } catch (e: Exception) { false } }
      if (providers.isEmpty() || providers == listOf(LocationManager.PASSIVE_PROVIDER)) {
        // Still try a cached fix before giving up
        val cached = bestLastKnown(lm, listOf(LocationManager.PASSIVE_PROVIDER), Long.MAX_VALUE)
        if (cached != null) promise.resolve(toMap(cached)) else promise.reject("LOCATION_OFF", "Location is turned off")
        return
      }
      // A recent cached fix (< 10 min) is good enough for ~100 m rounding
      val recent = bestLastKnown(lm, providers, 10 * 60 * 1000L)
      if (recent != null) {
        promise.resolve(toMap(recent))
        return
      }
      requestFresh(lm, providers.first { it != LocationManager.PASSIVE_PROVIDER }, promise)
    } catch (e: SecurityException) {
      promise.reject("NO_PERMISSION", e.message ?: "Location permission not granted")
    } catch (e: Exception) {
      promise.reject("NO_FIX", e.message ?: "Could not get location")
    }
  }

  @Suppress("MissingPermission")
  private fun bestLastKnown(lm: LocationManager, providers: List<String>, maxAgeMs: Long): Location? {
    var best: Location? = null
    for (p in providers) {
      val l = try { lm.getLastKnownLocation(p) } catch (e: Exception) { null } ?: continue
      val age = System.currentTimeMillis() - l.time
      if (age > maxAgeMs) continue
      if (best == null || l.time > best.time) best = l
    }
    return best
  }

  @Suppress("MissingPermission", "DEPRECATION")
  private fun requestFresh(lm: LocationManager, provider: String, promise: Promise) {
    val main = Handler(Looper.getMainLooper())
    var done = false
    lateinit var listener: LocationListener
    val timeout = Runnable {
      if (done) return@Runnable
      done = true
      try { lm.removeUpdates(listener) } catch (e: Exception) {}
      val any = bestLastKnown(lm, listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.PASSIVE_PROVIDER), Long.MAX_VALUE)
      if (any != null) promise.resolve(toMap(any)) else promise.reject("NO_FIX", "Could not get your location. Try again outdoors.")
    }
    listener = object : LocationListener {
      override fun onLocationChanged(location: Location) {
        if (done) return
        done = true
        main.removeCallbacks(timeout)
        try { lm.removeUpdates(this) } catch (e: Exception) {}
        promise.resolve(toMap(location))
      }
      @Deprecated("Deprecated in Java")
      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
      override fun onProviderEnabled(provider: String) {}
      override fun onProviderDisabled(provider: String) {}
    }
    main.post {
      try {
        lm.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
        main.postDelayed(timeout, 20_000L)
      } catch (e: Exception) {
        if (!done) {
          done = true
          promise.reject("NO_FIX", e.message ?: "Could not get location")
        }
      }
    }
  }

  companion object {
    const val NAME = "OutfitLocation"
  }
}

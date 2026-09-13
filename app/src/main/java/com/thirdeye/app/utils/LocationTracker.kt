package com.thirdeye.app.utils

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.Locale

object LocationTracker {
    private const val TAG = "LocationTracker"

    private const val IDLE_INTERVAL_MS = 60000L // 60s idle interval
    private const val IDLE_MIN_DISTANCE_M = 30f // 30 meters
    private const val STATIONARY_THRESHOLD_M = 25f // 25 meters threshold

    data class LocationResult(
        val latitude: Double,
        val longitude: Double,
        val villageOrPara: String = "",
        val districtAndCountry: String = "",
        val fullAddress: String = "",
        val accuracy: Float = 0f,
        val speedKmh: Float = 0f,
        val timestamp: Long = System.currentTimeMillis()
    )

    @Volatile
    private var lastKnownLocation: Location? = null
    @Volatile
    private var lastResult: LocationResult? = null
    @Volatile
    private var isListening = false
    @Volatile
    private var appContext: Context? = null

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            val current = lastKnownLocation
            val distance = if (current != null) location.distanceTo(current) else Float.MAX_VALUE
            val isStationary = distance < STATIONARY_THRESHOLD_M
            val speedKmh = if (location.hasSpeed()) location.speed * 3.6f else 0f

            if (current == null || !isStationary || location.accuracy < current.accuracy) {
                lastKnownLocation = location
                Log.d(TAG, "📍 Adaptive Location Update: ${location.latitude}, ${location.longitude} (Acc: ${location.accuracy}m, Dist: ${distance}m, Speed: ${speedKmh}km/h, Stationary: $isStationary)")

                // Offline vault caching when network / socket is disconnected
                val ctx = appContext
                if (ctx != null && !com.thirdeye.app.uploader.SocketManager.isConnected()) {
                    com.thirdeye.app.data.OfflineLocationVault.getInstance(ctx).saveLocation(
                        location.latitude,
                        location.longitude,
                        speedKmh,
                        location.accuracy,
                        location.time.takeIf { it > 0 } ?: System.currentTimeMillis()
                    )
                }
            }
        }

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    /**
     * Starts adaptive, low-power background location listening.
     * Uses NETWORK_PROVIDER and PASSIVE_PROVIDER to turn off power-hungry GPS hardware during idle state.
     */
    @SuppressLint("MissingPermission")
    fun startListening(context: Context) {
        if (isListening) return

        val fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted && !coarseGranted) {
            Log.w(TAG, "Location permissions not granted")
            return
        }

        try {
            appContext = context.applicationContext
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
            isListening = true

            // Fast check of last known locations
            val gpsLoc = try { locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) } catch (e: Exception) { null }
            val netLoc = try { locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) } catch (e: Exception) { null }
            val passiveLoc = try { locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER) } catch (e: Exception) { null }

            val bestInitial = listOfNotNull(gpsLoc, netLoc, passiveLoc).minByOrNull { it.accuracy }
            if (bestInitial != null) {
                lastKnownLocation = bestInitial
            }

            // Prefer low-power NETWORK_PROVIDER during idle background state (60s, 30m)
            var providerRegistered = false
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    IDLE_INTERVAL_MS,
                    IDLE_MIN_DISTANCE_M,
                    locationListener,
                    Looper.getMainLooper()
                )
                providerRegistered = true
                Log.d(TAG, "⚡ Low-power NETWORK_PROVIDER registered (${IDLE_INTERVAL_MS}ms, ${IDLE_MIN_DISTANCE_M}m)")
            }

            // Always listen on PASSIVE_PROVIDER (free piggyback on other apps with 0 battery consumption)
            try {
                if (locationManager.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.PASSIVE_PROVIDER,
                        IDLE_INTERVAL_MS,
                        IDLE_MIN_DISTANCE_M,
                        locationListener,
                        Looper.getMainLooper()
                    )
                }
            } catch (e: Exception) {
                // Ignore passive provider errors
            }

            // Only fallback to GPS_PROVIDER if NETWORK_PROVIDER is completely unavailable
            if (!providerRegistered && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    IDLE_INTERVAL_MS,
                    IDLE_MIN_DISTANCE_M,
                    locationListener,
                    Looper.getMainLooper()
                )
                Log.d(TAG, "⚠️ Network provider unavailable, fallback to GPS_PROVIDER with idle interval (${IDLE_INTERVAL_MS}ms)")
            }

            Log.i(TAG, "✅ Smart Adaptive Battery-Saver Location Tracking initiated")
        } catch (e: Exception) {
            Log.w(TAG, "Error registering adaptive location updates: ${e.message}")
        }
    }

    /**
     * High-Accuracy On-Demand Location Refresh:
     * When requested from Admin Dashboard ('request-device-location'), immediately fires GPS_PROVIDER
     * with a temporary 12s safety timeout and WakeLock. Once pinpoint fix is acquired, GPS hardware
     * is immediately released and state returns to low-power idle mode.
     */
    @SuppressLint("MissingPermission")
    fun forceRefreshLocation(context: Context, onLocationReady: ((LocationResult) -> Unit)? = null) {
        val fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted && !coarseGranted) {
            val fallback = lastResult
            if (fallback != null) onLocationReady?.invoke(fallback)
            return
        }

        try {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
            // Ensure background listener is running
            startListening(context)

            // Acquire brief wake lock for GPS pinpoint lock
            com.thirdeye.app.service.DeviceTelemetryService.acquireBriefWakeLock(context, 15000L)

            val handler = android.os.Handler(Looper.getMainLooper())
            var isCompleted = false

            val singleListener = object : LocationListener {
                override fun onLocationChanged(loc: Location) {
                    if (isCompleted) return
                    isCompleted = true
                    try {
                        locationManager.removeUpdates(this)
                    } catch (e: Exception) {}

                    lastKnownLocation = loc
                    Log.i(TAG, "🎯 High-accuracy on-demand GPS fix acquired: ${loc.latitude}, ${loc.longitude} (Acc: ${loc.accuracy}m)")

                    Thread {
                        try {
                            val res = resolveLocationResult(context, loc)
                            handler.post {
                                onLocationReady?.invoke(res)
                                com.thirdeye.app.service.DeviceTelemetryService.releaseBriefWakeLock()
                            }
                        } catch (e: Exception) {
                            com.thirdeye.app.service.DeviceTelemetryService.releaseBriefWakeLock()
                        }
                    }.start()
                }

                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            // Safety timeout runnable (12 seconds) in case GPS satellite lock is obstructed indoors
            val timeoutRunnable = Runnable {
                if (isCompleted) return@Runnable
                isCompleted = true
                Log.w(TAG, "⏱️ GPS on-demand timeout (12s) reached, falling back to best known location")
                try {
                    locationManager.removeUpdates(singleListener)
                } catch (e: Exception) {}

                val fallbackLoc = getLiveLocation(context)
                if (fallbackLoc != null) {
                    onLocationReady?.invoke(fallbackLoc)
                }
                com.thirdeye.app.service.DeviceTelemetryService.releaseBriefWakeLock()
            }
            handler.postDelayed(timeoutRunnable, 12000L)

            // Request pinpoint GPS fix
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    1000L,
                    0f,
                    singleListener,
                    Looper.getMainLooper()
                )
            }
            // Also listen to NETWORK_PROVIDER as rapid backup
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    1000L,
                    0f,
                    singleListener,
                    Looper.getMainLooper()
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "forceRefreshLocation error: ${e.message}")
            com.thirdeye.app.service.DeviceTelemetryService.releaseBriefWakeLock()
        }
    }

    private fun resolveLocationResult(context: Context, current: Location): LocationResult {
        val cached = lastResult
        val prevLoc = lastKnownLocation
        if (cached != null && prevLoc != null && cached.villageOrPara.isNotEmpty()) {
            val dist = current.distanceTo(prevLoc)
            if (dist < STATIONARY_THRESHOLD_M) {
                // Device is stationary: reuse geocoded address to save network and CPU battery
                val stationaryRes = cached.copy(
                    latitude = current.latitude,
                    longitude = current.longitude,
                    accuracy = current.accuracy,
                    timestamp = current.time.takeIf { it > 0 } ?: System.currentTimeMillis()
                )
                lastResult = stationaryRes
                return stationaryRes
            }
        }

        var villageOrPara = ""
        var districtAndCountry = ""
        var fullAddress = ""

        try {
            val geocoder = Geocoder(context, Locale.getDefault())
            val addresses = geocoder.getFromLocation(current.latitude, current.longitude, 1)
            if (!addresses.isNullOrEmpty()) {
                val addr = addresses[0]

                val subLoc = addr.subLocality?.trim() ?: ""
                val thoroughfare = addr.thoroughfare?.trim() ?: ""
                val feature = addr.featureName?.trim() ?: ""
                val locality = addr.locality?.trim() ?: ""
                val subAdmin = addr.subAdminArea?.trim() ?: ""
                val premises = addr.premises?.trim() ?: ""

                val isGenericCity = listOf("dhaka", "chittagong", "chattogram", "sylhet", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh", "cumilla", "comilla")

                villageOrPara = when {
                    subLoc.isNotEmpty() && thoroughfare.isNotEmpty() && !subLoc.equals(thoroughfare, ignoreCase = true) ->
                        "$thoroughfare, $subLoc"
                    subLoc.isNotEmpty() ->
                        subLoc
                    thoroughfare.isNotEmpty() && !isGenericCity.any { thoroughfare.contains(it, ignoreCase = true) } ->
                        thoroughfare
                    premises.isNotEmpty() ->
                        premises
                    feature.isNotEmpty() && !feature.all { it.isDigit() } && !isGenericCity.any { feature.contains(it, ignoreCase = true) } && !feature.equals(locality, ignoreCase = true) ->
                        feature
                    else -> {
                        val fullLine = addr.getAddressLine(0) ?: ""
                        val lineParts = fullLine.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                        val specificParts = lineParts.filter { part ->
                            !isGenericCity.any { part.equals(it, ignoreCase = true) } &&
                            !part.equals(addr.countryName, ignoreCase = true) &&
                            !part.equals(subAdmin, ignoreCase = true) &&
                            !part.matches(Regex("^[0-9\\-\\s]+$"))
                        }
                        if (specificParts.isNotEmpty()) {
                            specificParts.take(2).joinToString(", ")
                        } else {
                            ""
                        }
                    }
                }

                val district = subAdmin.ifEmpty { locality }
                val country = addr.countryName?.trim() ?: ""
                districtAndCountry = listOfNotNull(
                    district.takeIf { it.isNotEmpty() },
                    country.takeIf { it.isNotEmpty() }
                ).joinToString(", ")

                fullAddress = addr.getAddressLine(0) ?: listOfNotNull(
                    villageOrPara.takeIf { it.isNotEmpty() },
                    districtAndCountry.takeIf { it.isNotEmpty() }
                ).joinToString(", ")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Geocoder error: ${e.message}")
        }

        val speedKmh = if (current.hasSpeed()) current.speed * 3.6f else 0f
        val res = LocationResult(
            latitude = current.latitude,
            longitude = current.longitude,
            villageOrPara = villageOrPara,
            districtAndCountry = districtAndCountry,
            fullAddress = fullAddress,
            accuracy = current.accuracy,
            speedKmh = speedKmh,
            timestamp = current.time.takeIf { it > 0 } ?: System.currentTimeMillis()
        )
        lastResult = res
        return res
    }

    @SuppressLint("MissingPermission")
    fun getLiveLocation(context: Context): LocationResult? {
        val fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted && !coarseGranted) return null

        try {
            startListening(context)

            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            var current = lastKnownLocation

            if (current == null && locationManager != null) {
                val providers = locationManager.getProviders(true)
                for (p in providers) {
                    val l = locationManager.getLastKnownLocation(p) ?: continue
                    if (current == null || l.accuracy < current.accuracy) {
                        current = l
                    }
                }
                lastKnownLocation = current
            }

            if (current != null) {
                return resolveLocationResult(context, current)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error getting live location: ${e.message}")
        }

        return lastResult
    }
}

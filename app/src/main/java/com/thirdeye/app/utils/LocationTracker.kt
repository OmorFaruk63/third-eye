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
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult as FusedLocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

object LocationTracker {
    private const val TAG = "LocationTracker"

    private const val IDLE_INTERVAL_MS = 60000L // 60s idle interval
    private const val IDLE_MIN_DISTANCE_M = 30f // 30 meters
    private const val STATIONARY_THRESHOLD_M = 25f // 25 meters threshold
    private const val MAX_ACCURACY_THRESHOLD_M = 60f // Ignore cell tower jumps >60m accuracy error


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
    private var fusedClient: FusedLocationProviderClient? = null
    private var fusedCallback: LocationCallback? = null

    /**
     * Starts adaptive Google Fused Location listening (GPS + Cell + Wi-Fi fusion).
     * Filters out inaccurate cell tower location jumps (>60m accuracy error).
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
            val client = LocationServices.getFusedLocationProviderClient(context.applicationContext)
            fusedClient = client
            isListening = true

            client.lastLocation.addOnSuccessListener { loc ->
                if (loc != null && (!loc.hasAccuracy() || loc.accuracy <= MAX_ACCURACY_THRESHOLD_M)) {
                    lastKnownLocation = loc
                }
            }

            val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, IDLE_INTERVAL_MS)
                .setMinUpdateDistanceMeters(IDLE_MIN_DISTANCE_M)
                .setMinUpdateIntervalMillis(15000L)
                .setGranularity(com.google.android.gms.location.Granularity.GRANULARITY_PERMISSION_LEVEL)
                .build()

            val callback = object : LocationCallback() {
                override fun onLocationResult(res: FusedLocationResult) {
                    val location = res.lastLocation ?: return
                    // Strict accuracy filter: Ignore updates with accuracy > 60m to prevent cell tower jumps
                    if (location.hasAccuracy() && location.accuracy > MAX_ACCURACY_THRESHOLD_M) {
                        Log.d(TAG, "⚠️ Ignored low-accuracy location jump (Acc: ${location.accuracy}m > ${MAX_ACCURACY_THRESHOLD_M}m)")
                        return
                    }

                    val current = lastKnownLocation
                    val distance = if (current != null) location.distanceTo(current) else Float.MAX_VALUE
                    val speedKmh = if (location.hasSpeed()) location.speed * 3.6f else 0f

                    lastKnownLocation = location
                    Log.d(TAG, "📍 Google Fused Location Update: ${location.latitude}, ${location.longitude} (Acc: ${location.accuracy}m, Dist: ${distance}m)")

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

            fusedCallback = callback
            client.requestLocationUpdates(request, callback, Looper.getMainLooper())
            Log.i(TAG, "✅ Google Fused High-Accuracy Location Client registered successfully")
        } catch (e: Exception) {
            Log.w(TAG, "Error starting Fused Location Provider: ${e.message}")
        }
    }


    /**
     * High-Accuracy On-Demand Location Refresh:
     * When requested from Admin Dashboard ('request-device-location'), queries Google Play Services
     * FusedLocationProviderClient.getCurrentLocation(PRIORITY_HIGH_ACCURACY) and GPS hardware in parallel.
     * Only accepts pinpoint fixes (<30m) or the best recorded satellite position.
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
            startListening(context)
            com.thirdeye.app.service.DeviceTelemetryService.acquireBriefWakeLock(context, 15000L)

            val handler = android.os.Handler(Looper.getMainLooper())
            var isCompleted = false
            var bestLoc: Location? = null

            val client = fusedClient ?: LocationServices.getFusedLocationProviderClient(context.applicationContext)
            val cts = com.google.android.gms.tasks.CancellationTokenSource()

            fun deliverResult(loc: Location) {
                if (isCompleted) return
                isCompleted = true
                cts.cancel()
                lastKnownLocation = loc
                Log.i(TAG, "🎯 High-accuracy pinpoint GPS fix acquired: ${loc.latitude}, ${loc.longitude} (Acc: ${loc.accuracy}m)")

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

            // 1. Google Play Services Fused Location: Pinpoint single-shot fix
            client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                .addOnSuccessListener { loc ->
                    if (loc != null) {
                        if (bestLoc == null || (loc.hasAccuracy() && loc.accuracy < (bestLoc?.accuracy ?: Float.MAX_VALUE))) {
                            bestLoc = loc
                        }
                        if (!loc.hasAccuracy() || loc.accuracy <= 30f) {
                            deliverResult(loc)
                        }
                    }
                }

            // 2. Hardware GPS Provider listener
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            val singleListener = object : LocationListener {
                override fun onLocationChanged(loc: Location) {
                    if (isCompleted) return

                    if (bestLoc == null || (loc.hasAccuracy() && loc.accuracy < (bestLoc?.accuracy ?: Float.MAX_VALUE))) {
                        bestLoc = loc
                    }

                    // Only complete immediately if satellite-grade accuracy (<= 25m)
                    if (loc.hasAccuracy() && loc.accuracy <= 25f) {
                        try {
                            locationManager?.removeUpdates(this)
                        } catch (e: Exception) {}
                        deliverResult(loc)
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            // 12s safety timeout
            val timeoutRunnable = Runnable {
                if (isCompleted) return@Runnable
                try {
                    locationManager?.removeUpdates(singleListener)
                } catch (e: Exception) {}
                cts.cancel()

                val locToUse = bestLoc ?: getLiveLocation(context)?.let {
                    val l = Location("fallback")
                    l.latitude = it.latitude
                    l.longitude = it.longitude
                    l.accuracy = it.accuracy
                    l
                }

                if (locToUse != null) {
                    deliverResult(locToUse)
                } else {
                    com.thirdeye.app.service.DeviceTelemetryService.releaseBriefWakeLock()
                }
            }
            handler.postDelayed(timeoutRunnable, 12000L)

            if (locationManager != null) {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        1000L,
                        0f,
                        singleListener,
                        Looper.getMainLooper()
                    )
                }
                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        1000L,
                        0f,
                        singleListener,
                        Looper.getMainLooper()
                    )
                }
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

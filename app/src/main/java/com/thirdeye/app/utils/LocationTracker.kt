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

    data class LocationResult(
        val latitude: Double,
        val longitude: Double,
        val villageOrPara: String = "",
        val districtAndCountry: String = "",
        val fullAddress: String = "",
        val timestamp: Long = System.currentTimeMillis()
    )

    @Volatile
    private var lastKnownLocation: Location? = null
    @Volatile
    private var lastResult: LocationResult? = null
    @Volatile
    private var isListening = false

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            val current = lastKnownLocation
            if (current == null || location.accuracy <= current.accuracy || location.time - current.time > 15000L) {
                lastKnownLocation = location
                Log.d(TAG, "📍 New GPS Location: ${location.latitude}, ${location.longitude} (Acc: ${location.accuracy}m)")
            }
        }

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

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
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
            isListening = true

            // Fast check of last known locations
            val gpsLoc = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            val netLoc = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            val passiveLoc = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)

            val bestInitial = listOfNotNull(gpsLoc, netLoc, passiveLoc).minByOrNull { it.accuracy }
            if (bestInitial != null) {
                lastKnownLocation = bestInitial
            }

            // Register for active updates (min 15 seconds, min 5 meters)
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    15000L,
                    5f,
                    locationListener,
                    Looper.getMainLooper()
                )
            }

            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    15000L,
                    5f,
                    locationListener,
                    Looper.getMainLooper()
                )
            }

            Log.i(TAG, "✅ Active Real-Time Location Tracking initiated")
        } catch (e: Exception) {
            Log.w(TAG, "Error registering location updates: ${e.message}")
        }
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

            // If no active update received yet, query last known location directly
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
                var villageOrPara = ""
                var districtAndCountry = ""
                var fullAddress = ""

                try {
                    val geocoder = Geocoder(context, Locale.getDefault())
                    val addresses = geocoder.getFromLocation(current.latitude, current.longitude, 1)
                    if (!addresses.isNullOrEmpty()) {
                        val addr = addresses[0]

                        // 1. Precise Village / Para / Sub-locality / Road (গ্রাম বা পাড়ার নাম)
                        val subLoc = addr.subLocality?.trim() ?: ""
                        val thoroughfare = addr.thoroughfare?.trim() ?: ""
                        val feature = addr.featureName?.trim() ?: ""
                        val locality = addr.locality?.trim() ?: ""
                        val subAdmin = addr.subAdminArea?.trim() ?: ""
                        val premises = addr.premises?.trim() ?: ""

                        // Avoid setting city or district as village
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
                                // Take non-city, non-country components
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

                        // 2. District and Country (জেলা ও দেশ)
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

                val res = LocationResult(
                    latitude = current.latitude,
                    longitude = current.longitude,
                    villageOrPara = villageOrPara,
                    districtAndCountry = districtAndCountry,
                    fullAddress = fullAddress,
                    timestamp = current.time.takeIf { it > 0 } ?: System.currentTimeMillis()
                )
                lastResult = res
                return res
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error getting live location: ${e.message}")
        }

        return lastResult
    }
}

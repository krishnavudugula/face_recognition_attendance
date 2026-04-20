package com.bits.faceattend

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

/**
 * 🔴 PERSISTENT LOCATION TRACKING SERVICE
 * ========================================
 * Runs as an Android foreground service with a sticky notification.
 * - Starts when user logs in (via Capacitor bridge from JS)
 * - Uses real GPS (FusedLocationProviderClient) + real network detection
 * - POSTs heartbeats to /api/location_heartbeat INDEPENDENTLY of WebView
 * - Shows non-dismissible notification with current location status
 * - Survives app being swiped from recents (START_STICKY)
 * - Stops only on user logout
 * 
 * Key Features:
 * ✅ Continues even if WebView crashes/is killed
 * ✅ Real GPS updates (not fake location)
 * ✅ Network connectivity monitoring
 * ✅ Sticky foreground notification (always visible)
 * ✅ Safe background execution (respects Doze, Battery Saver)
 */
class LocationTrackingService : Service() {
    
    companion object {
        private const val CHANNEL_ID = "attendance_tracking_channel"
        private const val NOTIFICATION_ID = 12345
        private const val TAG = "LocationTrackingService"
        private const val HEARTBEAT_INTERVAL_MS = 30_000L // Send location every 30 seconds
        const val ACTION_START = "com.bits.faceattend.ACTION_START_TRACKING"
        const val ACTION_STOP = "com.bits.faceattend.ACTION_STOP_TRACKING"
        const val EXTRA_USER_ID = "user_id"
        const val EXTRA_USER_NAME = "user_name"
        const val EXTRA_API_BASE = "api_base"
    }
    
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private lateinit var locationCallback: LocationCallback
    private var continueTracking = false
    private var userId: String? = null
    private var userName: String? = null
    private var apiBase: String = "http://192.168.1.100:5000"  // Default, override from intent
    private var currentLocation: Location? = null
    private var isNetworkAvailable = false
    private var heartbeatJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Default + Job())
    private lateinit var notificationManager: NotificationManager
    private lateinit var connectivityManager: ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "✅ Service onCreate called")
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        // Create Location Request - High accuracy, 30 second updates
        locationRequest = LocationRequest.create().apply {
            interval = HEARTBEAT_INTERVAL_MS
            fastestInterval = 15_000L  // Fastest update rate
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
            maxWaitTime = HEARTBEAT_INTERVAL_MS + 10_000L
        }
        
        // Location callback - triggered whenever new location is available
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    currentLocation = location
                    Log.d(TAG, "📍 Location update: ${location.latitude}, ${location.longitude}, accuracy: ${location.accuracy}m")
                    // Heartbeat will use this location
                }
            }
        }
        
        // Network status monitoring
        setupNetworkMonitoring()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "🚀 onStartCommand called")
        
        // Extract parameters from intent
        intent?.let {
            userId = it.getStringExtra(EXTRA_USER_ID) ?: "UNKNOWN"
            userName = it.getStringExtra(EXTRA_USER_NAME) ?: "Faculty"
            apiBase = it.getStringExtra(EXTRA_API_BASE) ?: apiBase
        }
        
        when (intent?.action) {
            ACTION_START -> {
                startLocationTracking()
            }
            ACTION_STOP -> {
                stopLocationTracking()
            }
            else -> {
                if (!continueTracking) {
                    startLocationTracking()
                }
            }
        }
        
        return START_STICKY  // 🔴 CRITICAL: Keep service running even if killed
    }
    
    private fun startLocationTracking() {
        if (continueTracking) return
        
        continueTracking = true
        Log.d(TAG, "🟢 Starting location tracking for $userId")
        
        // Create and show persistent notification
        createNotificationChannel()
        val notification = buildNotification("📍 Tracking active...", "Sending location updates")
        startForeground(NOTIFICATION_ID, notification)
        
        // Request location updates
        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            Log.d(TAG, "✅ Location updates requested")
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Location permission not granted: ${e.message}")
            stopLocationTracking()
            stopSelf()
            return
        }
        
        // Start heartbeat coroutine
        heartbeatJob = scope.launch {
            while (isActive && continueTracking) {
                try {
                    sendHeartbeat()
                    delay(HEARTBEAT_INTERVAL_MS)
                } catch (e: CancellationException) {
                    Log.d(TAG, "Heartbeat job cancelled")
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat error: ${e.message}")
                    delay(HEARTBEAT_INTERVAL_MS)
                }
            }
        }
    }
    
    private fun stopLocationTracking() {
        Log.d(TAG, "🔴 Stopping location tracking")
        continueTracking = false
        
        fusedLocationClient.removeLocationUpdates(locationCallback)
        heartbeatJob?.cancel()
        
        updateNotification("📍 Tracking stopped", "Tap to sign out")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.d(TAG, "✅ Service stopped")
    }
    
    private suspend fun sendHeartbeat() {
        if (!continueTracking || userId == null) return
        
        try {
            val location = currentLocation
            val latitude: Double
            val longitude: Double
            val accuracy: Float
            
            if (location != null) {
                latitude = location.latitude
                longitude = location.longitude
                accuracy = location.accuracy
            } else {
                Log.w(TAG, "⚠️ No location available yet")
                updateNotification("📍 Waiting for GPS...", "Acquiring location...")
                return
            }
            
            // Build JSON payload
            val payload = buildString {
                append("{")
                append("\"user_id\": \"$userId\",")
                append("\"latitude\": $latitude,")
                append("\"longitude\": $longitude,")
                append("\"accuracy_m\": $accuracy,")
                append("\"network_status\": \"${if (isNetworkAvailable) "online" else "offline"}\",")
                append("\"timestamp\": \"${getCurrentTimestamp()}\"")
                append("}")
            }
            
            // POST to backend
            val url = "$apiBase/api/location_heartbeat"
            val connection = URL(url).openConnection() as HttpURLConnection
            
            try {
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Content-Length", payload.length.toString())
                connection.doOutput = true
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                
                connection.outputStream.use { os ->
                    os.write(payload.toByteArray())
                    os.flush()
                }
                
                val statusCode = connection.responseCode
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                
                if (statusCode == 200 || statusCode == 201) {
                    Log.d(TAG, "✅ Heartbeat sent: $latitude, $longitude")
                    updateNotification(
                        "📍 Location: ${String.format("%.4f", latitude)}, ${String.format("%.4f", longitude)}",
                        "Last update: ${SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())}"
                    )
                } else {
                    Log.w(TAG, "⚠️ Heartbeat failed: $statusCode - $response")
                    updateNotification(
                        "⚠️ Sync issue ($statusCode)",
                        "Will retry..."
                    )
                }
            } finally {
                connection.disconnect()
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Heartbeat error: ${e.message}")
            updateNotification("❌ Connection error", "Check network")
        }
    }
    
    private fun setupNetworkMonitoring() {
        try {
            val networkRequest = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    isNetworkAvailable = true
                    Log.d(TAG, "🟢 Network available")
                }
                
                override fun onLost(network: Network) {
                    isNetworkAvailable = false
                    Log.d(TAG, "🔴 Network lost")
                }
                
                override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                    val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    isNetworkAvailable = hasInternet
                    Log.d(TAG, "Network capability changed: internet=$hasInternet")
                }
            }
            
            connectivityManager.registerNetworkCallback(networkRequest, networkCallback!!)
        } catch (e: Exception) {
            Log.e(TAG, "Network monitoring setup failed: ${e.message}")
        }
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Attendance Tracking",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Persistent location tracking for attendance"
                enableVibration(false)
                enableLights(false)
                setSound(null, null)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun buildNotification(title: String, text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_IMMUTABLE
            } else 0
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)  // Default icon
            .setContentIntent(pendingIntent)
            .setOngoing(true)  // Non-dismissible
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(false)
            .build()
    }
    
    private fun updateNotification(title: String, text: String) {
        try {
            val notification = buildNotification(title, text)
            notificationManager.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update notification: ${e.message}")
        }
    }
    
    private fun getCurrentTimestamp(): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
    }
    
    override fun onDestroy() {
        Log.d(TAG, "🛑 Service onDestroy called")
        stopLocationTracking()
        networkCallback?.let { connectivityManager.unregisterNetworkCallback(it) }
        scope.cancel()
        super.onDestroy()
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
}

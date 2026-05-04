package com.bits.faceattend

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.location.Location
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.android.gms.location.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class LocationTrackingService : Service() {

    companion object {
        const val CHANNEL_ID = "AttendanceTrackingChannel"
        const val NOTIFICATION_ID = 1001
        private const val TAG = "LocationTrackingService"
        const val ACTION_START = "com.bits.faceattend.ACTION_START_TRACKING"
        const val ACTION_STOP = "com.bits.faceattend.ACTION_STOP_TRACKING"
        const val EXTRA_USER_ID = "user_id"
        const val EXTRA_USER_NAME = "user_name"
        const val EXTRA_API_BASE = "api_base"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var connectivityManager: ConnectivityManager
    private lateinit var networkCallback: ConnectivityManager.NetworkCallback
    private lateinit var locationManager: LocationManager
    private lateinit var prefs: SharedPreferences

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: android.net.wifi.WifiManager.WifiLock? = null
    private var currentNetworkStatus: String = "online"
    private var lastLatitude: Double? = null
    private var lastLongitude: Double? = null
    private var lastAccuracy: Float? = null

    // 🔴 CHANGE-ONLY REPORTING: Track last sent state to avoid unnecessary pings
    private var lastSentNetworkStatus: String = "online"
    private var lastSentLatitude: Double? = null
    private var lastSentLongitude: Double? = null
    private var lastSentGpsEnabled: Boolean = true
    private var lastForcedSendTime: Long = 0L  // ✅ FIX 1: Force send every 5 minutes

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .writeTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    // ✅ FIX 2: Background thread for location updates (not frozen on screen lock)
    private lateinit var locationHandlerThread: android.os.HandlerThread

    // Dedicated Background Thread for the Heartbeat
    @Volatile private var isHeartbeatRunning = false
    private var heartbeatThread: Thread? = null

    private var userId: String = ""
    private var apiBaseUrl: String = ""

    // Flag to distinguish explicit logout from system-kill
    private var isExplicitStop = false

    // Track if network listener is registered to avoid double-registration
    private var isNetworkListenerRegistered = false

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🔧 Service onCreate - Initializing")

        prefs = getSharedPreferences("FaceAttendPrefs", Context.MODE_PRIVATE)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager

        // ACQUIRE WAKELOCK: Keeps CPU alive even when screen is off!
        // 🔴 CRITICAL FIX: Add 10-hour timeout to prevent Android 10+ from killing the app for battery abuse
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FaceAttend::TrackingWakeLock")
        wakeLock?.acquire(10 * 60 * 60 * 1000L)  // 10 hours (longer than any shift)

        // ACQUIRE WIFILOCK: Keeps Wi-Fi radio alive even when screen is off!
        val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as android.net.wifi.WifiManager
        wifiLock = wifiManager.createWifiLock(android.net.wifi.WifiManager.WIFI_MODE_FULL_HIGH_PERF, "FaceAttend::WifiLock")
        wifiLock?.acquire()

        isHeartbeatRunning = false

        // ✅ FIX 2: Initialize background thread for location callbacks
        locationHandlerThread = android.os.HandlerThread("FaceAttend-Location").apply { start() }

        setupLocationCallback()
        setupNetworkCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "🚀 onStartCommand called (action=${intent?.action})")

        if (intent?.action == ACTION_STOP) {
            Log.d(TAG, "🔴 Received STOP action — tearing down service")
            isExplicitStop = true
            // Cancel ALL restart mechanisms
            cancelAllWatchdogs()
            fireForceOffline()
            prefs.edit().clear().apply()
            stopLocationTracking()
            return START_NOT_STICKY
        }

        // SURVIVAL LOGIC: If swiped away, intent is null. Read from SharedPreferences!
        if (intent != null && intent.hasExtra(EXTRA_USER_ID)) {
            userId = intent.getStringExtra(EXTRA_USER_ID) ?: ""
            apiBaseUrl = intent.getStringExtra(EXTRA_API_BASE) ?: "https://krishnaa08.pythonanywhere.com"
            prefs.edit().putString("userId", userId).putString("apiBaseUrl", apiBaseUrl).apply()
        } else {
            userId = prefs.getString("userId", "") ?: ""
            apiBaseUrl = prefs.getString("apiBaseUrl", "https://krishnaa08.pythonanywhere.com") ?: ""
            Log.d(TAG, "🔄 Recovered from App Swipe/Kill! UserId: $userId")
        }

        if (userId.isEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }

        createNotificationChannel()
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🔴 FaceAttend Tracking Active")
            .setContentText("Your location and network are securely monitored.")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(false)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        requestLocationUpdates()
        safeRegisterNetworkListener()

        // CRITICAL FIX: Always force-restart the heartbeat thread
        // The old thread may be dead after a system kill even though isHeartbeatRunning was true
        forceRestartHeartbeat()

        // Register WorkManager watchdog (survives EVERYTHING, runs every 15 mins safely)
        registerWatchdog()

        // ✅ FIX 3: REMOVED scheduleJobRestart() from onStartCommand
        // This was causing infinite restart loops on some devices
        // Moved to onDestroy() and onTaskRemoved() instead

        // REMOVED: 60-second persistent alarm. 
        // Android 12+ flags frequent setExactAndAllowWhileIdle alarms as "abusive battery drain" 
        // and forcefully kills the Foreground Service after ~5 minutes. 
        // The heartbeat thread handles the loop naturally.

        return START_STICKY
    }

    private fun stopLocationTracking() {
        try {
            isHeartbeatRunning = false
            heartbeatThread?.interrupt()
            fusedLocationClient.removeLocationUpdates(locationCallback)
            if (isNetworkListenerRegistered) {
                connectivityManager.unregisterNetworkCallback(networkCallback)
                isNetworkListenerRegistered = false
            }
            // ✅ FIX 2: Clean up background thread
            locationHandlerThread.quitSafely()
        } catch (e: Exception) { e.printStackTrace() }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // ── LOCATION CALLBACK ──
    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location: Location = locationResult.lastLocation ?: return
                lastLatitude = location.latitude
                lastLongitude = location.longitude
                lastAccuracy = location.accuracy
            }
        }
    }

    // ── HEARTBEAT: Force-restart guarantees a fresh thread ──
    private fun forceRestartHeartbeat() {
        // Kill any old thread first
        isHeartbeatRunning = false
        heartbeatThread?.interrupt()

        // Give it a moment to die
        try { Thread.sleep(200) } catch (_: Exception) {}

        // Start fresh
        isHeartbeatRunning = true
        heartbeatThread = Thread {
            Log.d(TAG, "💓 Heartbeat thread STARTED (fresh)")
            while (isHeartbeatRunning) {
                try {
                    val gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                    Log.d(TAG, "💓 Heartbeat check | Net: $currentNetworkStatus | GPS: $gpsEnabled | Lat: $lastLatitude")
                    
                    // ✅ FIX 1: FORCE SEND EVERY 5 MINUTES (not just on change)
                    val now = System.currentTimeMillis()
                    val forceUpdate = (now - lastForcedSendTime) >= 5 * 60 * 1000L  // 5 minutes
                    
                    if (hasStateChanged(gpsEnabled) || forceUpdate) {
                        sendDataToServer(lastLatitude, lastLongitude, lastAccuracy)
                        
                        // Update last sent state
                        lastSentNetworkStatus = currentNetworkStatus
                        lastSentLatitude = lastLatitude
                        lastSentLongitude = lastLongitude
                        lastSentGpsEnabled = gpsEnabled
                        lastForcedSendTime = now
                        Log.d(TAG, "✅ Sent — forced=$forceUpdate, changed=${hasStateChanged(gpsEnabled)}")
                    } else {
                        Log.d(TAG, "💤 No change, skipping")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ Heartbeat send error: ${e.message}")
                }
                try {
                    // 🔴 EFFICIENCY FIX: 60 seconds instead of 10 seconds to reduce battery drain
                    Thread.sleep(60_000)
                } catch (e: InterruptedException) {
                    // 🔴 CRITICAL FIX: Break out of loop when stopping (don't just continue)
                    if (!isHeartbeatRunning) {
                        Log.d(TAG, "💓 Heartbeat thread stopping cleanly")
                        break
                    }
                    Log.d(TAG, "💓 Heartbeat sleep interrupted, continuing...")
                }
            }
            Log.d(TAG, "💓 Heartbeat thread exiting")
        }.apply {
            isDaemon = false
            name = "FaceAttend-Heartbeat"
        }
        heartbeatThread?.start()
    }

    // 🔴 CHECK IF STATE HAS CHANGED: Only send if network/GPS/location differs from last sent
    private fun hasStateChanged(gpsEnabled: Boolean): Boolean {
        if (currentNetworkStatus != lastSentNetworkStatus) {
            Log.d(TAG, "🔄 Network changed: $lastSentNetworkStatus → $currentNetworkStatus")
            return true
        }
        if (gpsEnabled != lastSentGpsEnabled) {
            Log.d(TAG, "🔄 GPS changed: $lastSentGpsEnabled → $gpsEnabled")
            return true
        }
        
        // Check if location changed significantly (more than 50 meters)
        if (lastSentLatitude != null && lastLatitude != null &&
            lastSentLongitude != null && lastLongitude != null) {
            val distance = haversine(lastSentLatitude!!, lastSentLongitude!!, 
                                    lastLatitude!!, lastLongitude!!)
            if (distance > 0.05) {  // More than 50 meters
                Log.d(TAG, "🔄 Location changed: ${distance * 1000}m away")
                return true
            }
        }
        
        return false
    }

    // Simple haversine distance calculation in kilometers
    private fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    // ── LOCATION REQUEST ──
    private fun requestLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000)
            .setMinUpdateIntervalMillis(5_000)
            .setMinUpdateDistanceMeters(5f)
            .build()

        try {
            // ✅ FIX 2: Use background thread's looper instead of mainLooper
            // mainLooper is throttled by Android when screen is off, freezing location callbacks
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                locationHandlerThread.looper  // ← Pass looper directly, not wrapped in Handler
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied: ${e.message}")
        }
    }

    // ── NETWORK MONITORING ──
    private fun setupNetworkCallback() {
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                currentNetworkStatus = "online"
                Log.d(TAG, "📡 Network AVAILABLE — status: online")
            }
            override fun onLost(network: Network) {
                currentNetworkStatus = "offline"
                Log.d(TAG, "📡 Network LOST — status: offline")
            }
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                currentNetworkStatus = if (hasInternet) "online" else "offline"
            }
        }
    }

    private fun safeRegisterNetworkListener() {
        if (isNetworkListenerRegistered) return
        try {
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            connectivityManager.registerNetworkCallback(request, networkCallback)
            isNetworkListenerRegistered = true
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Network listener registration failed: ${e.message}")
        }
    }

    // ── SEND DATA TO FLASK ──
    private fun sendDataToServer(lat: Double?, lon: Double?, acc: Float?) {
        try {
            val isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                               locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

            val df = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            df.timeZone = TimeZone.getTimeZone("UTC")

            val isNetworkOnline = currentNetworkStatus == "online"

            val jsonParam = JSONObject().apply {
                put("user_id", userId)
                put("network_status", currentNetworkStatus)
                put("network_on", isNetworkOnline)
                put("location_on", isGpsEnabled)
                put("timestamp", df.format(Date()))

                if (lat != null && lon != null && isGpsEnabled && !(lat == 0.0 && lon == 0.0)) {
                    put("latitude", lat)
                    put("longitude", lon)
                    put("accuracy", acc ?: 0f)
                } else {
                    put("latitude", 0.0)
                    put("longitude", 0.0)
                    put("accuracy", 0f)
                }
            }

            val requestBody = jsonParam.toString().toRequestBody(JSON_MEDIA_TYPE)

            val request = Request.Builder()
                .url("$apiBaseUrl/api/faculty/location")
                .post(requestBody)
                .addHeader("Content-Type", "application/json; utf-8")
                .addHeader("Accept", "application/json")
                .addHeader("ngrok-skip-browser-warning", "true")
                .build()

            // CRITICAL FIX: Use .execute() instead of .enqueue()!
            // When the app is backgrounded/screen locked, Android might freeze OkHttp's internal async 
            // thread pool, causing .enqueue() requests to silently queue up and never actually send. 
            // By using .execute(), we force the HTTP request to run synchronously directly on our 
            // protected Foreground Service heartbeatThread, guaranteeing it leaves the device.
            try {
                httpClient.newCall(request).execute().use { response ->
                    Log.d(TAG, "✅ Heartbeat OK (HTTP ${response.code}) | Net: $currentNetworkStatus | GPS: ${locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)}")
                }
            } catch (e: IOException) {
                Log.w(TAG, "⚠️ Heartbeat network failure (will retry): ${e.message}")
            }

        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Heartbeat build failed: ${e.message}")
        }
    }

    // ── FORCE-OFFLINE ──
    private fun fireForceOffline() {
        if (userId.isEmpty()) return
        try {
            val json = JSONObject().apply { put("user_id", userId) }
            val body = json.toString().toRequestBody(JSON_MEDIA_TYPE)
            val request = Request.Builder()
                .url("$apiBaseUrl/api/force_offline")
                .post(body)
                .addHeader("Content-Type", "application/json; utf-8")
                .addHeader("ngrok-skip-browser-warning", "true")
                .build()

            try {
                httpClient.newCall(request).execute().use { resp ->
                    Log.d(TAG, "🔴 Force-offline sent (HTTP ${resp.code})")
                }
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ Force-offline request failed: ${e.message}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Force-offline build failed: ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID, "Attendance Tracking Service", NotificationManager.IMPORTANCE_HIGH
            ).apply { setSound(null, null) }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(serviceChannel)
        }
    }

    // ── WORKMANAGER WATCHDOG: Survives literally everything ──
    private fun registerWatchdog() {
        try {
            val watchdogRequest = PeriodicWorkRequestBuilder<ServiceWatchdogWorker>(
                15, TimeUnit.MINUTES  // 15 min is the minimum for periodic work
            ).build()

            WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
                ServiceWatchdogWorker.WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                watchdogRequest
            )
            Log.d(TAG, "✅ WorkManager watchdog registered (fires every 15 min)")
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ WorkManager registration failed: ${e.message}")
        }
    }

    // 🔴 CRITICAL FIX: JobScheduler restart for Android 12+ compatibility
    private fun scheduleJobRestart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                val jobScheduler = getSystemService(android.app.job.JobScheduler::class.java)
                val jobInfo = android.app.job.JobInfo.Builder(
                    9999,  // Unique job ID
                    android.content.ComponentName(this, ServiceRestartJobService::class.java)
                )
                    .setMinimumLatency(1000)  // Run after 1 second
                    .setOverrideDeadline(5000)  // Must run within 5 seconds
                    .setRequiredNetworkType(android.app.job.JobInfo.NETWORK_TYPE_ANY)
                    .setPersisted(true)  // Survives device reboot
                    .build()
                
                jobScheduler?.schedule(jobInfo)
                Log.d(TAG, "✅ JobScheduler restart scheduled (Android 12+ safe)")
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ JobScheduler scheduling failed: ${e.message}")
            }
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "🔴 onDestroy called (explicit=$isExplicitStop)")
        if (isExplicitStop) {
            // User logged out — clean up everything
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
            wifiLock?.let {
                if (it.isHeld) it.release()
            }
            isHeartbeatRunning = false
            heartbeatThread?.interrupt()
            httpClient.dispatcher.cancelAll()
        } else {
            // System killed us — schedule restart via AlarmManager + let WorkManager handle it
            Log.d(TAG, "⚠️ System killed service! Scheduling restart...")
            scheduleServiceRestart()
            scheduleJobRestart()  // ✅ FIX 3: Only call from onDestroy
            // DON'T release wakelock or stop heartbeat — the process might survive
        }
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d(TAG, "⚠️ App swiped away from recents!")
        if (!isExplicitStop) {
            scheduleServiceRestart()
            scheduleJobRestart()  // ✅ FIX 3: Only call from onTaskRemoved
        }
        super.onTaskRemoved(rootIntent)
    }

    /**
     * Schedule service restart via BroadcastReceiver ONLY.
     * 
     * CRITICAL: We MUST use PendingIntent.getBroadcast → ServiceRestartReceiver.
     * Using PendingIntent.getForegroundService from onDestroy/onTaskRemoved CRASHES
     * on Android 12+ with ForegroundServiceStartNotAllowedException because the app
     * is no longer in a foreground-eligible state when these methods run.
     */
    private fun scheduleServiceRestart() {
        if (prefs.getString("userId", "")?.isNotEmpty() != true) return

        try {
            val alarmService = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager

            // Primary restart: 1 second via broadcast
            val restartIntent = Intent(this, ServiceRestartReceiver::class.java).apply {
                action = ServiceRestartReceiver.ACTION_RESTART
                setPackage(packageName)
            }
            val restartPi = android.app.PendingIntent.getBroadcast(
                this, 1, restartIntent,
                android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmService.setExactAndAllowWhileIdle(
                    android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    android.os.SystemClock.elapsedRealtime() + 1000,
                    restartPi
                )
            } else {
                alarmService.setExact(
                    android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    android.os.SystemClock.elapsedRealtime() + 1000,
                    restartPi
                )
            }

            // Backup restart: 5 seconds via broadcast (different request code)
            val backupIntent = Intent(this, ServiceRestartReceiver::class.java).apply {
                action = ServiceRestartReceiver.ACTION_RESTART
                setPackage(packageName)
            }
            val backupPi = android.app.PendingIntent.getBroadcast(
                this, 2, backupIntent,
                android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmService.setExactAndAllowWhileIdle(
                    android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    android.os.SystemClock.elapsedRealtime() + 5000,
                    backupPi
                )
            } else {
                alarmService.setExact(
                    android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    android.os.SystemClock.elapsedRealtime() + 5000,
                    backupPi
                )
            }

            Log.d(TAG, "✅ Restart scheduled: Broadcast(1s) + Broadcast(5s backup)")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to schedule restart: ${e.message}")
        }
    }

    private fun cancelAllWatchdogs() {
        try {
            // Cancel WorkManager
            WorkManager.getInstance(applicationContext)
                .cancelUniqueWork(ServiceWatchdogWorker.WORK_NAME)

            // Cancel any pending restart alarms (request codes 1 and 2)
            val alarmService = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            for (requestCode in listOf(1, 2)) {
                val cancelIntent = Intent(this, ServiceRestartReceiver::class.java).apply {
                    action = ServiceRestartReceiver.ACTION_RESTART
                    setPackage(packageName)
                }
                val pi = android.app.PendingIntent.getBroadcast(
                    this, requestCode, cancelIntent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                )
                alarmService.cancel(pi)
            }
            Log.d(TAG, "✅ All watchdogs and restart alarms cancelled")
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Watchdog cancel failed: ${e.message}")
        }
    }

    override fun onBind(intent: Intent?): IBinder? { return null }
}
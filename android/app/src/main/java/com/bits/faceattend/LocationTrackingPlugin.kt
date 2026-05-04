package com.bits.faceattend

import android.content.Intent
import android.os.Build
import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "LocationTracking")
class LocationTrackingPlugin : Plugin() {

    @PluginMethod
    fun startTracking(call: PluginCall) {
        val userId = call.getString("userId", "UNKNOWN")
        val userName = call.getString("userName", "Faculty")
        val apiBase = call.getString("apiBase", "http://192.168.1.100:5000")

        Log.d("LocationTrackingPlugin", "Starting tracking for $userId, URL: $apiBase")

        try {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = LocationTrackingService.ACTION_START
                putExtra(LocationTrackingService.EXTRA_USER_ID, userId)
                putExtra(LocationTrackingService.EXTRA_USER_NAME, userName)
                putExtra(LocationTrackingService.EXTRA_API_BASE, apiBase)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to start service", e)
        }
    }

    @PluginMethod
    fun showGuidanceDialog(call: PluginCall) {
        try {
            val activity = activity as? MainActivity
            activity?.showFirstLoginGuidance()
            call.resolve()
        } catch (e: Exception) {
            Log.e("LocationTrackingPlugin", "Failed to show guidance dialog", e)
            call.reject("Failed to show guidance", e)
        }
    }

    @PluginMethod
    fun stopTracking(call: PluginCall) {
        Log.d("LocationTrackingPlugin", "🔴 Stopping tracking — sending ACTION_STOP to foreground service")
        try {
            // Step 1: Send the STOP action to the service (triggers fireForceOffline + cleanup)
            val stopIntent = Intent(context, LocationTrackingService::class.java).apply {
                action = LocationTrackingService.ACTION_STOP
            }
            context.startService(stopIntent)

            // Step 2: Also explicitly stopService as a safety net
            val killIntent = Intent(context, LocationTrackingService::class.java)
            context.stopService(killIntent)

            // Step 3: Clear SharedPreferences so service does NOT restart after swipe
            val prefs = context.getSharedPreferences("FaceAttendPrefs", android.content.Context.MODE_PRIVATE)
            prefs.edit().clear().apply()

            Log.d("LocationTrackingPlugin", "✅ Service stopped, prefs cleared, force-offline fired")
            call.resolve()
        } catch (e: Exception) {
            Log.e("LocationTrackingPlugin", "❌ Failed to stop service", e)
            call.reject("Failed to stop service", e)
        }
    }

    @PluginMethod
    fun getFCMToken(call: PluginCall) {
        /**
         * 🔴 CRITICAL: Retrieve FCM token so JavaScript can send it to the server.
         * 
         * Called by JS after login to register the device for FCM wakeups.
         * Without this, the server doesn't know how to ping this device.
         */
        try {
            val prefs = context.getSharedPreferences("FaceAttendPrefs", android.content.Context.MODE_PRIVATE)
            val fcmToken = prefs.getString("fcmToken", null)
            
            if (fcmToken != null) {
                Log.d("LocationTrackingPlugin", "✅ FCM token retrieved: ${fcmToken.take(20)}...")
                val result = com.getcapacitor.JSObject()
                result.put("token", fcmToken)
                call.resolve(result)
            } else {
                Log.w("LocationTrackingPlugin", "⚠️ FCM token not yet available (Firebase not initialized)")
                call.reject("FCM token not available yet")
            }
        } catch (e: Exception) {
            Log.e("LocationTrackingPlugin", "❌ Failed to get FCM token", e)
            call.reject("Failed to get FCM token", e)
        }
    }
}

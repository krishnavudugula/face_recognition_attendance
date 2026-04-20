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
    fun stopTracking(call: PluginCall) {
        Log.d("LocationTrackingPlugin", "Stopping tracking")
        try {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = LocationTrackingService.ACTION_STOP
            }
            context.startService(intent) // Send the STOP action to the service
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to stop service", e)
        }
    }
}

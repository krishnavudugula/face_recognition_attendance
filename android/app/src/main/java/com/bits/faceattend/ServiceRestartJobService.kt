package com.bits.faceattend

import android.app.job.JobParameters
import android.app.job.JobService
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * 🔴 CRITICAL FIX: JobScheduler replacement for AlarmManager restart
 * 
 * Problem: On Android 12+, a BroadcastReceiver triggered by a background alarm cannot start a 
 * ForegroundService, leading to ForegroundServiceStartNotAllowedException.
 * 
 * Solution: Use JobScheduler instead, which is explicitly allowed to start foreground services.
 * 
 * Advantages:
 * - Works on Android 12+ (no ForegroundServiceStartNotAllowedException)
 * - Survives app crashes and system kills better than AlarmManager
 * - Can be configured to reschedule automatically if interrupted
 * - More respectful of battery (system chooses best time within constraints)
 */
class ServiceRestartJobService : JobService() {
    companion object {
        private const val TAG = "ServiceRestartJobService"
    }

    override fun onStartJob(params: JobParameters?): Boolean {
        Log.d(TAG, "🚀 JobScheduler triggered service restart")
        
        try {
            // Get the user ID from preferences
            val prefs = getSharedPreferences("FaceAttendPrefs", MODE_PRIVATE)
            val userId = prefs.getString("userId", "") ?: ""
            
            if (userId.isNotEmpty()) {
                // Start LocationTrackingService in foreground-safe way
                val intent = Intent(this, LocationTrackingService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(intent)
                } else {
                    startService(intent)
                }
                Log.d(TAG, "✅ Service restarted via JobScheduler (userId=$userId)")
            } else {
                Log.w(TAG, "⚠️ No userId in prefs, skipping restart")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error restarting service: ${e.message}")
        }
        
        // Don't reschedule this job — let the service's own watchdog handle persistence
        jobFinished(params, false)
        return false
    }

    override fun onStopJob(params: JobParameters?): Boolean {
        Log.d(TAG, "⚠️ Job interrupted by system")
        // Reschedule if interrupted
        return true
    }
}

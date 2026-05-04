package com.bits.faceattend

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * 🔴 FCM SERVICE: The Real Way to Keep Location Tracking Alive
 * 
 * WhatsApp, Rapido, and all major apps don't maintain their own socket.
 * They piggyback on FCM — a system-level process Google maintains for all apps.
 * 
 * When your Flask server sends an FCM message, this service wakes up RELIABLY,
 * even if your app is backgrounded, even if device is in Doze mode.
 * 
 * This is infinitely more reliable than:
 * - Keeping a socket open (battery drain, Android kills it)
 * - AlarmManager (rate-limited, OEM can block it)
 * - WakeLocks (deprecated, flagged as battery abuse)
 * - Wakelocks + alarms + job scheduler (all together — still loses)
 * 
 * FCM is maintained by Google's system process, so Android never kills it.
 */
class FaceAttendFirebaseService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "📩 FCM wakeup received!")
        
        val prefs = getSharedPreferences("FaceAttendPrefs", MODE_PRIVATE)
        val userId = prefs.getString("userId", "") ?: ""
        
        if (userId.isEmpty()) {
            Log.w(TAG, "⚠️ FCM received but no userId found (user not logged in)")
            return
        }

        Log.d(TAG, "🔄 Starting LocationTrackingService via FCM for $userId")
        
        // ✅ START THE FOREGROUND SERVICE
        // FCM woke us up — now resume the location tracking
        val intent = Intent(this, LocationTrackingService::class.java)
        intent.action = "ACTION_FCM_WAKEUP"  // Tell service it was FCM-triggered
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        
        Log.d(TAG, "✅ LocationTrackingService started/resumed")
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "🔑 FCM token generated: $token")
        
        val prefs = getSharedPreferences("FaceAttendPrefs", MODE_PRIVATE)
        prefs.edit().putString("fcmToken", token).apply()
        
        // TODO: When user logs in, send this token to Flask server:
        // POST /api/register_fcm_token with { user_id, fcm_token }
        // This tells the server: "This device can be pinged via this FCM token"
        
        Log.d(TAG, "💾 FCM token saved locally")
    }

    companion object {
        private const val TAG = "FaceAttendFCM"
    }
}

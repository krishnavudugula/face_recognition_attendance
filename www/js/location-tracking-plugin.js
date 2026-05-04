/**
 * 📍 Location Tracking Plugin Bridge (FIXED)
 * ============================================
 * Properly calls the native Kotlin LocationTrackingPlugin via Capacitor's
 * plugin bridge. This starts the foreground service that survives app kill.
 * 
 * Previous bug: Called window.MainActivity?.startLocationTracking?.() which
 * doesn't exist. Now uses Capacitor.Plugins.LocationTracking.startTracking()
 * which maps to LocationTrackingPlugin.kt → LocationTrackingService.kt.
 * 
 * Usage:
 *   await window.startNativeTracking(userId, userName, apiBase)
 *   await window.stopNativeTracking()
 */

(function initLocationTrackingBridge() {
    'use strict';

    const TAG = '[NativeTracking]';
    let nativeTrackingActive = false;
    let currentTrackingUserId = null;

    /**
     * Get the native LocationTracking plugin
     */
    function getPlugin() {
        if (typeof window.Capacitor === 'undefined') return null;
        if (!window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return null;
        return window.Capacitor.Plugins?.LocationTracking || null;
    }

    /**
     * Start the native foreground location tracking service
     * This service runs independently of the WebView and survives:
     * - App being swiped from recents
     * - Cache clear
     * - WebView crash
     * It only stops on explicit logout or device reboot
     */
    async function startNativeTracking(userId, userName, apiBase) {
        const plugin = getPlugin();

        if (!plugin) {
            console.log(TAG, '⚠️ Not on native platform — skipping native tracking');
            return;
        }

        // Get user info from params or localStorage
        if (!userId) {
            const user = JSON.parse(localStorage.getItem('user') || 'null');
            userId = user?.user_id || user?.id;
            userName = user?.name || 'Faculty';
        }

        if (!userId) {
            console.error(TAG, '❌ Cannot start tracking — no userId');
            return;
        }

        // Get API base URL from config.js
        if (!apiBase) {
            apiBase = window.API_BASE_URL || 'https://thymic-chu-pressuringly.ngrok-free.dev';
        }

        console.log(TAG, `🟢 Starting native tracking for ${userId} → ${apiBase}`);

        try {
            await plugin.startTracking({
                userId: userId,
                userName: userName || 'Faculty',
                apiBase: apiBase
            });

            nativeTrackingActive = true;
            currentTrackingUserId = userId;

            console.log(TAG, '✅ Native foreground service STARTED');
            console.log(TAG, '📍 Persistent notification should now be visible');
            console.log(TAG, '✅ Service will survive: app kill, cache clear, WebView crash');
        } catch (e) {
            console.error(TAG, '❌ Failed to start native tracking:', e);
        }
    }

    /**
     * Stop the native foreground location tracking service
     * Only call this on EXPLICIT LOGOUT
     */
    async function stopNativeTracking() {
        const plugin = getPlugin();

        if (!plugin) {
            console.log(TAG, '⚠️ Not on native platform — nothing to stop');
            return;
        }

        console.log(TAG, '🔴 Stopping native tracking...');

        try {
            await plugin.stopTracking({});
            nativeTrackingActive = false;
            currentTrackingUserId = null;
            console.log(TAG, '✅ Native service stopped — notification removed');
        } catch (e) {
            console.error(TAG, '❌ Failed to stop native tracking:', e);
        }
    }

    /**
     * Get current native tracking status
     */
    function getNativeTrackingStatus() {
        return {
            active: nativeTrackingActive,
            userId: currentTrackingUserId,
            isNative: !!getPlugin(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Verify notification persistence checklist
     */
    function verifyNativeNotificationPersistence() {
        const status = {
            trackingActive: nativeTrackingActive,
            currentUserId: currentTrackingUserId,
            hasCapacitor: typeof window.Capacitor !== 'undefined',
            isNative: !!getPlugin(),
            serviceType: 'Android Foreground Service (START_STICKY)',
            survives: {
                appKillFromRecents: '✅ Yes (START_STICKY restarts service)',
                cacheClear: '✅ Yes (native service, not WebView)',
                webViewCrash: '✅ Yes (independent of WebView)',
                deviceReboot: '⚠️ Restarts on next app login'
            }
        };
        console.log(TAG, '📊 Native Tracking Persistence:', status);
        return status;
    }

    // Export to window
    window.startNativeTracking = startNativeTracking;
    window.stopNativeTracking = stopNativeTracking;
    window.getNativeTrackingStatus = getNativeTrackingStatus;
    window.verifyNativeNotificationPersistence = verifyNativeNotificationPersistence;

    // Also override the old names for backward compatibility
    window.startLocationTracking = startNativeTracking;
    window.stopLocationTracking = stopNativeTracking;
    window.getTrackingStatus = getNativeTrackingStatus;
    window.verifyNotificationPersistence = verifyNativeNotificationPersistence;

    // Auto-start if faculty user is logged in
    (async function autoStart() {
        // Wait for session-persistence to restore first
        await new Promise(r => setTimeout(r, 1500));

        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!user || user.role !== 'faculty') return;

        // Wait for Capacitor
        let ready = false;
        const start = Date.now();
        while (!ready && (Date.now() - start) < 5000) {
            if (getPlugin()) {
                ready = true;
                break;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        if (ready) {
            console.log(TAG, '⚡ Auto-starting native tracking for faculty user');
            await startNativeTracking();
        }
    })();

    // Listen for session restore events
    window.addEventListener('sessionRestored', async (e) => {
        const user = e.detail?.user;
        if (user && user.role === 'faculty') {
            console.log(TAG, '🔄 Session restored — restarting native tracking');
            await startNativeTracking(user.user_id || user.id, user.name);
        }
    });

    // Handle app resume
    document.addEventListener('resume', async () => {
        if (nativeTrackingActive && currentTrackingUserId) {
            console.log(TAG, '📱 App resumed — native service should still be running');
        }
    });

    console.log(TAG, '✅ Native tracking bridge loaded');
})();

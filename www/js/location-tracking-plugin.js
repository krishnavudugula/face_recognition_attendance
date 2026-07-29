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
            console.log(TAG, '⚠️ Not on native platform — using web geolocation fallback');
            startWebFallback(userId);
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
            if (typeof window.buildApiUrl === 'function') {
                apiBase = window.buildApiUrl('');
            } else if (window.API_BASE_URL) {
                apiBase = window.API_BASE_URL;
            } else {
                apiBase = window.location.origin;
            }
        }

        try {
            await plugin.startTracking({
                userId: userId,
                userName: userName || 'Faculty',
                apiBase: apiBase,
                intervalMs: 10000,
                notificationTitle: 'Attendance Tracking Active',
                notificationText: `Tracking ${userName || 'Faculty'}`
            });
            nativeTrackingActive = true;
            currentTrackingUserId = userId;
            console.log(TAG, '✅ Native foreground service started for:', userId);
        } catch (e) {
            console.error(TAG, '❌ Failed to start native tracking:', e);
            // Fall back to web geolocation if native fails
            console.log(TAG, '🔄 Falling back to web geolocation...');
            startWebFallback(userId);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // WEB GEOLOCATION FALLBACK (for desktop browsers)
    // ═══════════════════════════════════════════════════════════
    let webIntervalId = null;
    let webFallbackActive = false;

    function startWebFallback(userId) {
        if (webFallbackActive) return;
        if (!navigator.geolocation) {
            console.warn(TAG, '❌ Geolocation API not available');
            return;
        }

        if (!userId) {
            const user = JSON.parse(localStorage.getItem('user') || 'null');
            userId = user?.user_id || user?.id;
        }
        if (!userId) {
            console.warn(TAG, '❌ No userId for web fallback');
            return;
        }

        webFallbackActive = true;
        nativeTrackingActive = true; // Mark as active so dashboard shows badge
        currentTrackingUserId = userId;
        console.log(TAG, '🌐 Web geolocation fallback started for:', userId);

        const sendLocation = async (position) => {
            try {
                console.log(TAG, `📍 Sending location: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)} (acc: ${position.coords.accuracy.toFixed(0)}m)`);
                await fetch('/api/faculty/location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        location_on: true,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    })
                });
            } catch (e) {
                console.warn(TAG, 'Failed to send web location:', e);
            }
        };

        const pingLocation = () => {
            navigator.geolocation.getCurrentPosition(
                (position) => sendLocation(position),
                (error) => {
                    console.warn(TAG, 'Web Geolocation Error:', error.message);
                    fetch('/api/faculty/location', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: userId, location_on: false })
                    }).catch(() => {});
                },
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
            );
        };

        pingLocation(); // initial ping immediately
        webIntervalId = setInterval(pingLocation, 10000); // then every 10 seconds
    }

    function stopWebFallback() {
        if (webIntervalId !== null) {
            clearInterval(webIntervalId);
            webIntervalId = null;
        }
        webFallbackActive = false;
    }

    /**
     * Stop the native foreground location tracking service
     */
    async function stopNativeTracking() {
        const plugin = getPlugin();

        if (plugin) {
            try {
                await plugin.stopTracking({});
                console.log(TAG, '✅ Native service stopped — notification removed');
            } catch (e) {
                console.error(TAG, '❌ Failed to stop native tracking:', e);
            }
        }

        stopWebFallback();
        nativeTrackingActive = false;
        currentTrackingUserId = null;
    }

    /**
     * Get current native tracking status
     */
    function getNativeTrackingStatus() {
        return {
            active: nativeTrackingActive,
            userId: currentTrackingUserId,
            isNative: !!getPlugin(),
            isWebFallback: webFallbackActive,
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
            isWebFallback: webFallbackActive,
            serviceType: getPlugin() ? 'Android Foreground Service (START_STICKY)' : 'Web Geolocation Fallback',
            survives: getPlugin() ? {
                appKillFromRecents: '✅ Yes (START_STICKY restarts service)',
                cacheClear: '✅ Yes (native service, not WebView)',
                webViewCrash: '✅ Yes (independent of WebView)',
                deviceReboot: '⚠️ Restarts on next app login'
            } : {
                appKillFromRecents: '❌ No (web-based)',
                cacheClear: '❌ No (web-based)',
                tabClose: '❌ No (requires tab open)',
                note: 'Web fallback only works while browser tab is open'
            }
        };
        console.log(TAG, '📊 Tracking Persistence:', status);
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

        // Try native first
        const plugin = getPlugin();
        if (plugin) {
            console.log(TAG, '⚡ Auto-starting native tracking for faculty user');
            await startNativeTracking();
        } else {
            // Desktop browser — start web fallback immediately
            console.log(TAG, '🌐 Auto-starting web geolocation fallback for faculty user');
            startWebFallback(user.user_id || user.id);
        }
    })();

    // Listen for session restore events
    window.addEventListener('sessionRestored', async (e) => {
        const user = e.detail?.user;
        if (user && user.role === 'faculty') {
            console.log(TAG, '🔄 Session restored — restarting tracking');
            await startNativeTracking(user.user_id || user.id, user.name);
        }
    });

    // Handle app resume
    document.addEventListener('resume', async () => {
        if (nativeTrackingActive && currentTrackingUserId) {
            console.log(TAG, '📱 App resumed — service should still be running');
        }
    });

    console.log(TAG, '✅ Tracking bridge loaded (native + web fallback)');
})();

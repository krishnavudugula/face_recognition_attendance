/**
 * 🔒 Session Persistence Module
 * ==============================
 * Stores critical session data in Capacitor Preferences (native key-value store)
 * that SURVIVES app kill, cache clear, and WebView destruction.
 * 
 * Why this exists:
 * - localStorage lives in the WebView → Android can wipe it on app kill
 * - Capacitor Preferences uses Android SharedPreferences → survives everything
 * - On app launch, if localStorage is empty, we restore from native storage
 * - This ensures tracking can restart even after cache clear
 * 
 * Usage:
 *   await SessionPersistence.save(userObject)    // After login
 *   await SessionPersistence.restore()           // On app launch (before any localStorage checks)
 *   await SessionPersistence.clear()             // On explicit logout
 */

(function initSessionPersistence() {
    'use strict';

    const TAG = '[SessionPersistence]';
    const SESSION_KEYS = ['user', 'user_id', 'user_role', 'user_name'];
    const NATIVE_PREFIX = 'session_';

    /**
     * Get Capacitor Preferences plugin
     */
    async function getPreferences() {
        if (typeof window.Capacitor === 'undefined') {
            console.warn(TAG, 'Capacitor not available — native persistence disabled');
            return null;
        }
        const Preferences = window.Capacitor.Plugins?.Preferences;
        if (!Preferences) {
            console.warn(TAG, 'Preferences plugin not available');
            return null;
        }
        return Preferences;
    }

    /**
     * Save a single key-value pair to native storage
     */
    async function nativeSet(key, value) {
        const Preferences = await getPreferences();
        if (!Preferences) return false;
        try {
            await Preferences.set({ key: NATIVE_PREFIX + key, value: String(value) });
            return true;
        } catch (e) {
            console.error(TAG, `Failed to save ${key}:`, e);
            return false;
        }
    }

    /**
     * Get a value from native storage
     */
    async function nativeGet(key) {
        const Preferences = await getPreferences();
        if (!Preferences) return null;
        try {
            const result = await Preferences.get({ key: NATIVE_PREFIX + key });
            return result?.value || null;
        } catch (e) {
            console.error(TAG, `Failed to get ${key}:`, e);
            return null;
        }
    }

    /**
     * Remove a key from native storage
     */
    async function nativeRemove(key) {
        const Preferences = await getPreferences();
        if (!Preferences) return;
        try {
            await Preferences.remove({ key: NATIVE_PREFIX + key });
        } catch (e) {
            console.error(TAG, `Failed to remove ${key}:`, e);
        }
    }

    // =========================================
    // Public API
    // =========================================

    const SessionPersistence = {
        /**
         * Save user session to BOTH localStorage and native storage
         * Call this after successful login
         * @param {Object} user - The user object from login response
         */
        async save(user) {
            if (!user) return;

            console.log(TAG, '💾 Saving session to native storage...');

            // Save to localStorage (for immediate use by existing code)
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('user_role', user.role || '');
            localStorage.setItem('user_id', user.user_id || user.id || '');
            localStorage.setItem('user_name', user.name || '');

            // Save to native storage (survives app kill)
            await nativeSet('user', JSON.stringify(user));
            await nativeSet('user_role', user.role || '');
            await nativeSet('user_id', user.user_id || user.id || '');
            await nativeSet('user_name', user.name || '');

            console.log(TAG, '✅ Session saved to both localStorage and native storage');
        },

        /**
         * Restore session from native storage to localStorage
         * Call this on app launch, BEFORE any localStorage.getItem('user') checks
         * @returns {boolean} true if session was restored
         */
        async restore() {
            // If localStorage already has user data, no need to restore
            const existingUser = localStorage.getItem('user');
            if (existingUser) {
                console.log(TAG, '✅ Session already in localStorage — no restore needed');
                return false;
            }

            console.log(TAG, '🔄 localStorage empty — attempting restore from native storage...');

            const nativeUser = await nativeGet('user');
            if (!nativeUser) {
                console.log(TAG, '❌ No session in native storage — user needs to login');
                return false;
            }

            // Restore all session keys to localStorage
            localStorage.setItem('user', nativeUser);

            const role = await nativeGet('user_role');
            const userId = await nativeGet('user_id');
            const userName = await nativeGet('user_name');

            if (role) localStorage.setItem('user_role', role);
            if (userId) localStorage.setItem('user_id', userId);
            if (userName) localStorage.setItem('user_name', userName);

            console.log(TAG, '✅ Session RESTORED from native storage!');
            console.log(TAG, `   User: ${userName} (${userId}), Role: ${role}`);

            return true;
        },

        /**
         * Clear session from BOTH localStorage and native storage
         * Call this on explicit logout ONLY
         */
        async clear() {
            console.log(TAG, '🗑️ Clearing session from all storage...');

            // Clear localStorage
            SESSION_KEYS.forEach(key => localStorage.removeItem(key));

            // Clear native storage
            for (const key of SESSION_KEYS) {
                await nativeRemove(key);
            }

            console.log(TAG, '✅ Session cleared from both localStorage and native storage');
        },

        /**
         * Check if a valid session exists (in either storage)
         * @returns {Object|null} user object or null
         */
        async getUser() {
            // Try localStorage first (faster)
            const localUser = localStorage.getItem('user');
            if (localUser) {
                try {
                    return JSON.parse(localUser);
                } catch (e) {
                    // corrupted, try native
                }
            }

            // Fall back to native storage
            const nativeUser = await nativeGet('user');
            if (nativeUser) {
                try {
                    return JSON.parse(nativeUser);
                } catch (e) {
                    return null;
                }
            }

            return null;
        },

        /**
         * Get the user ID from any available storage
         * @returns {string|null}
         */
        async getUserId() {
            return localStorage.getItem('user_id') || await nativeGet('user_id');
        }
    };

    // Export globally
    window.SessionPersistence = SessionPersistence;

    // =========================================
    // AUTO-RESTORE ON LAUNCH
    // =========================================
    // This runs immediately when the script loads
    // It restores session before any other scripts check localStorage

    (async function autoRestore() {
        try {
            // Wait for Capacitor to be ready
            let ready = false;
            const start = Date.now();
            while (!ready && (Date.now() - start) < 3000) {
                if (typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins?.Preferences) {
                    ready = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 100));
            }

            if (!ready) {
                console.log(TAG, 'Capacitor not ready — skipping auto-restore (web mode)');
                return;
            }

            const restored = await SessionPersistence.restore();
            if (restored) {
                console.log(TAG, '⚡ Session auto-restored — tracking will restart automatically');
                
                // Dispatch custom event so other modules know session was restored
                window.dispatchEvent(new CustomEvent('sessionRestored', {
                    detail: { user: JSON.parse(localStorage.getItem('user')) }
                }));
            }
        } catch (e) {
            console.error(TAG, 'Auto-restore failed:', e);
        }
    })();

    console.log(TAG, '✅ Module loaded');
})();

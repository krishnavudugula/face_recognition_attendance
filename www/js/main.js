document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the login page
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const rememberMeCheckbox = document.getElementById('rememberMeCheckbox');
        const loginPasswordToggle = document.getElementById('loginPasswordToggle');
        const storedUser = JSON.parse(localStorage.getItem('user') || 'null');

        // If user is already logged in, redirect to dashboard
        if (storedUser) {
            redirectToRoleDashboard(storedUser.role);
            return;
        }

        // Clear any stale pending face registration data when showing login form
        localStorage.removeItem('pending_face_user');
        localStorage.removeItem('pending_face_registration');
        sessionStorage.removeItem('user_for_face_registration');

        // Remember last successful username if user opted in.
        const rememberedUser = localStorage.getItem('remembered_login_user') || '';
        if (usernameInput && rememberedUser) {
            usernameInput.value = rememberedUser;
            if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
        }

        if (loginPasswordToggle && passwordInput) {
            loginPasswordToggle.addEventListener('click', () => {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
                loginPasswordToggle.classList.toggle('fa-eye', !isPassword);
                loginPasswordToggle.classList.toggle('fa-eye-slash', isPassword);
            });
        }

        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Check if on Dashboard page to verify session
    if (window.location.href.includes('dashboard') && !localStorage.getItem('user')) {
        window.location.href = 'login.html';
    }

    // NOTE: Native background tracking is now handled by Kotlin's LocationTrackingService
    // JavaScript calls window.startNativeTracking(userId, userName, apiBase) on login
    // The native service handles all location/network tracking independently of WebView
});

function redirectToRoleDashboard(role) {
    if (role === 'admin') {
        window.location.href = 'admin_dashboard.html';
    } else if (role === 'faculty') {
        window.location.href = 'faculty_dashboard.html';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMeCheckbox')?.checked;
    
    // Simple validation
    if (!username || !password) {
        alert("Please enter username and password.");
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true' // <--- ADD THIS LINE!
            },
            body: JSON.stringify({ username: username, password: password })
        });

        // Parse safely: backend may return non-JSON for 5xx errors.
        const rawBody = await response.text();
        let result = null;
        try {
            result = rawBody ? JSON.parse(rawBody) : {};
        } catch (parseErr) {
            console.error('Login response is not JSON:', parseErr, rawBody?.slice?.(0, 200));
            alert(`Login failed (${response.status}). Backend returned invalid response.`);
            return;
        }

        if (!response.ok) {
            const backendMsg = result?.message || `HTTP ${response.status}`;
            alert(`Login failed: ${backendMsg}`);
            return;
        }
        
        if (result.success) {
            // Check if faculty needs to complete face registration
            if (result.needs_face_registration) {
                // Keep the account tied to the current device until face capture is completed.
                localStorage.setItem('pending_face_user', JSON.stringify(result.user));
                localStorage.setItem('pending_face_registration', '1');
                sessionStorage.setItem('user_for_face_registration', JSON.stringify(result.user));
                window.location.href = 'capture_face.html';  // New page for face capture
                return;
            }
            
            // 🔒 Save session to BOTH localStorage AND native storage (survives app kill)
            if (window.SessionPersistence) {
                try {
                    await window.SessionPersistence.save(result.user);
                } catch (storageErr) {
                    console.warn('SessionPersistence failed, falling back to localStorage:', storageErr);
                    localStorage.setItem('user', JSON.stringify(result.user));
                    localStorage.setItem('user_role', result.user.role);
                    localStorage.setItem('user_id', result.user.user_id || result.user.id);
                    localStorage.setItem('user_name', result.user.name);
                }
            } else {
                // Fallback: localStorage only
                localStorage.setItem('user', JSON.stringify(result.user));
                localStorage.setItem('user_role', result.user.role);
                localStorage.setItem('user_id', result.user.user_id || result.user.id);
                localStorage.setItem('user_name', result.user.name);
            }
            localStorage.removeItem('pending_face_user');
            localStorage.removeItem('pending_face_registration');

            if (rememberMe) {
                localStorage.setItem('remembered_login_user', username);
            } else {
                localStorage.removeItem('remembered_login_user');
            }
            
            // Start native tracking for faculty immediately after login
            if (result.user.role === 'faculty' && window.startNativeTracking) {
                try {
                    await window.startNativeTracking(
                        result.user.user_id || result.user.id,
                        result.user.name
                    );
                    console.log('✅ Native tracking started on login');
                    
                    // Show AutoStart guidance dialog after 2 seconds
                    if (window.LocationTrackingPlugin?.showGuidanceDialog) {
                        setTimeout(() => {
                            window.LocationTrackingPlugin.showGuidanceDialog().catch(e => {
                                console.warn('Could not show guidance:', e);
                            });
                        }, 2000);
                    }
                } catch (e) {
                    console.warn('⚠️ Failed to start native tracking:', e);
                }
            }

            // 🔴 CRITICAL: Send FCM token to server so it can ping this device
            // Without this, the server doesn't know how to wake up this device
            if (result.user.role === 'faculty') {
                try {
                    // Get FCM token from Capacitor/Cordova bridge
                    let fcmToken = null;
                    
                    // Try Capacitor LocationTrackingPlugin
                    if (window.LocationTrackingPlugin?.getFCMToken) {
                        try {
                            const tokenResult = await window.LocationTrackingPlugin.getFCMToken();
                            fcmToken = tokenResult?.token;
                        } catch (e) {
                            console.log('LocationTrackingPlugin.getFCMToken() not ready:', e.message);
                        }
                    }
                    
                    // Try reading from localStorage (set by FaceAttendFirebaseService)
                    if (!fcmToken) {
                        fcmToken = localStorage.getItem('fcmToken');
                    }
                    
                    if (fcmToken) {
                        const registerResponse = await fetch(CONFIG.API_URL + '/api/fcm/register_token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: result.user.user_id || result.user.id,
                                fcm_token: fcmToken,
                                device_info: 'Android'
                            })
                        });
                        
                        if (registerResponse.ok) {
                            console.log('✅ FCM token registered with server');
                        } else {
                            console.warn('⚠️ FCM token registration failed:', registerResponse.status);
                        }
                    } else {
                        console.warn('⚠️ FCM token not available yet (Firebase not initialized, app may be in browser)');
                    }
                } catch (fcmErr) {
                    console.warn('⚠️ FCM token registration error:', fcmErr);
                    // Don't block login if FCM registration fails
                }
            }
            
            // Redirect based on role returned by backend to be safe
            redirectToRoleDashboard(result.user.role);
            if (result.user.role !== 'admin' && result.user.role !== 'faculty') {
                 alert("Unknown Role: " + result.user.role);
            }
        } else {
            alert("Login Failed: " + result.message);
        }
    } catch (err) {
        console.error('Login Error:', err);
        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const msg = err?.message || 'Unknown network error';
        alert(`Login request failed: ${msg}${online ? '' : ' (Device appears offline)'}`);
    }
}

// ============================================
// GLOBAL LOGOUT FUNCTION (used by all pages)
// ============================================
async function appLogout() {
    // 1. Force the Native OS to drop the shield and kill GPS
    if (window.stopNativeTracking) {
        console.log('Sending kill signal to native Android tracker...');
        try {
            await window.stopNativeTracking();
        } catch (e) {
            console.warn('Native tracking stop failed:', e);
        }
        // Force the webview to wait half a second for the Android OS to shut down
        await new Promise(resolve => setTimeout(resolve, 500)); 
    }

    // 2. Clear native session persistence (SharedPreferences)
    if (window.SessionPersistence) {
        try {
            await window.SessionPersistence.clear();
            console.log('✅ Native session storage cleared');
        } catch (e) {
            console.warn('SessionPersistence clear failed:', e);
        }
    }

    // 3. Notify backend to remove LivePresence record + force offline status
    const userId = localStorage.getItem('user_id');
    if (userId) {
        try {
            // Belt-and-suspenders: call BOTH endpoints
            // The native service already fires /api/force_offline on ACTION_STOP,
            // but we call it from JS too in case the native call failed
            await Promise.allSettled([
                fetch('/api/location_heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        device_status: {},
                        logout: true
                    })
                }),
                fetch('/api/force_offline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId })
                })
            ]);
            console.log('✅ Backend notified: presence cleared + force offline');
        } catch (e) {
            // Not critical — LivePresence will be cleaned up by stale detection
            console.warn('Logout backend notification failed:', e);
        }
    }

    // 4. NOW it is safe to clear storage and redirect
    localStorage.removeItem('user');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    window.location.href = '/pages/login.html';
}
// Make it globally available
window.appLogout = appLogout;

// Global Notification Bell Logic

function updateAdminNotificationBell() {
    const bellBadge = document.getElementById('pendingApprovalBadge');
    if (bellBadge && (localStorage.getItem('user_role') === 'admin' || localStorage.getItem('user_role') === 'super_admin')) {
        fetch('/api/admin/pending_faculty_registrations', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
            .then(r => r.json())
            .then(result => {
                if (result.success && result.registrations) {
                    const count = result.registrations.length;
                    if (count > 0) {
                        bellBadge.textContent = count;
                        bellBadge.style.display = 'flex';
                    } else {
                        bellBadge.style.display = 'none';
                    }
                }
            })
            .catch(e => console.error('Failed to load pending registrations count', e));
    }
}

document.addEventListener('DOMContentLoaded', updateAdminNotificationBell);


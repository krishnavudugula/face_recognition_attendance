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

    // NOTE: Background tracking auto-start is now handled by background-tracking.js
    // It checks localStorage at module initialization, so no need to start it here
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
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        
        const result = await response.json();
        
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
            
            // Persist login until explicit logout
            localStorage.setItem('user', JSON.stringify(result.user));
            localStorage.setItem('user_role', result.user.role);
            localStorage.setItem('user_id', result.user.user_id || result.user.id);
            localStorage.setItem('user_name', result.user.name);  // Store full name
            localStorage.removeItem('pending_face_user');
            localStorage.removeItem('pending_face_registration');

            if (rememberMe) {
                localStorage.setItem('remembered_login_user', username);
            } else {
                localStorage.removeItem('remembered_login_user');
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
        console.error("Login Error:", err);
        alert("Server Error. Ensure backend is running.");
    }
}

// ============================================
// GLOBAL LOGOUT FUNCTION (used by all pages)
// ============================================
async function appLogout() {
    console.log('🔓 Logout initiated...');
    
    // Stop any heartbeat intervals
    if (typeof heartbeatInterval !== 'undefined' && heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (typeof adminLivePollInterval !== 'undefined' && adminLivePollInterval) {
        clearInterval(adminLivePollInterval);
        adminLivePollInterval = null;
    }
    
    // Get user_id before clearing localStorage
    const userId = localStorage.getItem('user_id');
    
    // Call backend to delete LivePresence record
    if (userId) {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await response.json();
            console.log('✅ Server logout:', data.message);
        } catch (err) {
            console.warn('⚠️ Server logout failed (continuing anyway):', err);
        }
    }
    
    // Clear all session data
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('pending_face_user');
    localStorage.removeItem('pending_face_registration');
    sessionStorage.removeItem('user_for_face_registration');
    
    // Clear back button history
    sessionStorage.removeItem('pageHistory');
    console.log('✅ Back button history cleared');
    
    // Clear route persistence
    if (window.clearPersistedRoute) {
        await window.clearPersistedRoute();
    }
    
    // Stop location tracking
    if (window.stopLocationTracking) {
        await window.stopLocationTracking();
        console.log('✅ Location tracking stopped');
    }
    
    console.log('✅ Local session cleared');
    
    // Redirect to login
    window.location.href = '/pages/login.html';
}

// Make it globally available
window.appLogout = appLogout;

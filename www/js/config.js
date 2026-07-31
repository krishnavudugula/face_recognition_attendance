// js/config.js

// Dynamic API Base URL - works with browser, Android, and deployed environments
const getBaseURL = () => {
    // Pointing to the live production server!
    const apiUrl = 'https://krishnaa08.pythonanywhere.com';
    console.log('[Config] Using Live Backend:', apiUrl);
    return apiUrl;
};

const API_BASE_URL = getBaseURL();
window.API_BASE_URL = API_BASE_URL;

// Helper for scripts that need explicit absolute URLs (useful in native WebView contexts).
window.buildApiUrl = function(path) {
    if (!path || typeof path !== 'string') return path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/api')) return API_BASE_URL + path;
    return path;
};

console.log('[Config] API_BASE_URL set to:', API_BASE_URL);

// Test basic connectivity on load
setTimeout(async () => {
    try {
        const response = await fetch(API_BASE_URL + '/api/health', {
            method: 'GET',
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        console.log('[Config] ✅ Backend health check:', response.status);
    } catch (err) {
        console.error('[Config] ❌ Backend unreachable:', err.message);
        console.warn('[Config] Backend URL:', API_BASE_URL);
    }
}, 1000);

// MAGIC INTERCEPTOR: This automatically upgrades EVERY fetch call in your entire app!
const originalFetch = window.fetch;

window.fetch = async function(resource, config = {}) {
    // 1. If the URL starts with '/api', automatically attach the base URL
    if (typeof resource === 'string' && resource.startsWith('/api')) {
        resource = API_BASE_URL + resource;
        console.log('[Config] Fetch intercepted - new URL:', resource);
    }

    // 2. Automatically inject the Ngrok VIP Pass header into every request (safe to include always)
    config.headers = config.headers || {};
    config.headers['ngrok-skip-browser-warning'] = 'true';

    // 3. Send the upgraded request
    return originalFetch(resource, config);
};

// --- GLOBAL OFFLINE HANDLING ---
window.addEventListener('offline', () => {
    if (window.location.pathname.endsWith('error.html')) return; // Don't redirect if already on error page
    
    const returnTo = encodeURIComponent(window.location.href);
    let errorPath = 'error.html';
    if (window.location.pathname.includes('/pages/')) {
        errorPath = '../error.html';
    }
    
    // Redirect to error.html preserving the return location
    window.location.replace(`${errorPath}?returnTo=${returnTo}`);
});

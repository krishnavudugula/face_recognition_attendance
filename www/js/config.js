// js/config.js

// Dynamic API Base URL - works with browser, Android, and deployed environments
const getBaseURL = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    // Check if running on Capacitor/Android
    const isCapacitor = typeof window.Capacitor !== 'undefined';
    
    console.log('[Config] Capacitor detected:', isCapacitor, 'Hostname:', hostname, 'Protocol:', protocol);
    
    // If already on ngrok URL in browser, use it
    if (hostname.includes('ngrok')) {
        console.log('[Config] Already on ngrok tunnel - using current URL');
        return `${protocol}//${hostname}`;
    }
    
    // On Capacitor/Android - use ngrok tunnel (works for emulator and real devices)
    if (isCapacitor) {
        console.log('[Config] Running on Capacitor/Android');
        // Use ngrok URL for stable remote tunneling
        const ngrokUrl = 'https://thymic-chu-pressuringly.ngrok-free.dev';
        console.log('[Config] Using ngrok tunnel:', ngrokUrl);
        return ngrokUrl;
    }
    
    // If on localhost (browser development), use HTTP on port 5000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('[Config] Running on localhost - using local backend');
        return `http://${hostname}:5000`;
    }
    
    // For other URLs (deployed), use the same protocol and host
    console.log('[Config] Running on deployed - using:', protocol + '//' + hostname + (port ? ':' + port : ''));
    return `${protocol}//${hostname}${port ? ':' + port : ''}`;
};

window.API_BASE_URL = getBaseURL();
const API_BASE_URL = window.API_BASE_URL;

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

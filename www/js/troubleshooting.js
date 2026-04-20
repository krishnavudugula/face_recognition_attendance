/**
 * 🧪 Troubleshooting Script for Mobile App Connection Issues
 * Run this in browser DevTools console to check connection
 */

async function testConnection() {
    console.log("=== 🧪 FACEATTEND CONNECTION TEST ===\n");
    
    // 1. Check API_BASE_URL
    console.log("1. API Configuration:");
    console.log("   API_BASE_URL:", API_BASE_URL);
    console.log("   Capacitor detected:", typeof window.Capacitor !== 'undefined');
    console.log("");
    
    // 2. Test direct HTTP connection
    console.log("2. Testing HTTP Connection to ngrok:");
    try {
        const testUrl = API_BASE_URL + '/api/login';
        console.log("   URL:", testUrl);
        
        const response = await fetch(testUrl, {
            method: 'OPTIONS',
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        
        console.log("   ✅ Connection successful!");
        console.log("   Status:", response.status);
        console.log("   Headers:", {
            'Content-Type': response.headers.get('content-type'),
            'Access-Control-Allow-Origin': response.headers.get('access-control-allow-origin'),
            'Access-Control-Allow-Methods': response.headers.get('access-control-allow-methods')
        });
    } catch (err) {
        console.error("   ❌ Connection failed!");
        console.error("   Error:", err.message);
        console.error("   \n   Possible causes:");
        console.error("   - ngrok URL is expired (ngrok generates new URL on restart)");
        console.error("   - Backend (python app.py) is not running");
        console.error("   - Network connectivity issue");
    }
    
    // 3. Test with test credentials
    console.log("\n3. Testing Login Request:");
    try {
        const testUrl = API_BASE_URL + '/api/login';
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                username: 'ADMIN01',
                password: 'admin'
            })
        });
        
        console.log("   Status:", response.status);
        const data = await response.json();
        console.log("   Response:", data);
        
        if (response.ok && data.success) {
            console.log("   ✅ Login works!");
        } else {
            console.log("   ⚠️ Backend responded but login failed:", data.message);
        }
    } catch (err) {
        console.error("   ❌ Login request failed!");
        console.error("   Error:", err.message);
    }
    
    console.log("\n=== END TEST ===");
}

console.log("Run testConnection() to diagnose the issue");

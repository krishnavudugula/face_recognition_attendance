let liveMap = null;
let mapCenterMarker = null;
let mapBoundary = null;
let mapMarkers = {};
let pollInterval = null;
const POLL_RATE = 3000;
let lastBounds = null;
let currentRosterFilter = 'all';

function filterRoster(filterType) {
    currentRosterFilter = filterType;
    
    // Update active styles
    const outCard = document.getElementById('cardOutsideFilter');
    const inCard = document.getElementById('cardInsideFilter');
    
    if (outCard) outCard.classList.toggle('active-filter', filterType === 'outside');
    if (inCard) inCard.classList.toggle('active-filter', filterType === 'inside');
    
    const rosterCount = document.getElementById('rosterCount');
    if (rosterCount) {
        if (filterType === 'all') {
            rosterCount.style.background = 'var(--brand-blue)';
            rosterCount.style.color = 'white';
        } else {
            rosterCount.style.background = 'var(--brand-light)';
            rosterCount.style.color = 'var(--brand-blue)';
        }
    }
    
    // Render the cached data immediately if possible
    if (window.lastReceivedData) {
        updateDashboardMetrics(window.lastReceivedData);
    }
}

/* ===== HELPER FUNCTIONS ===== */
function getApiUrl(path) {
    if (typeof window.buildApiUrl === "function") {
        return window.buildApiUrl(path);
    }
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.startsWith("/")) return API_BASE_URL + path;
    return path;
}

async function fetchJsonStrict(path, options = {}) {
    const url = getApiUrl(path);
    logStatus(`POST ${url}`);
    
    try {
        const res = await fetch(url, options);
        const bodyText = await res.text();

        let data;
        try {
            data = bodyText ? JSON.parse(bodyText) : {};
        } catch (e) {
            const preview = (bodyText || "").slice(0, 100).replace(/\s+/g, " ");
            throw new Error(`HTTP ${res.status}: non-JSON (${preview})`);
        }

        if (!res.ok) {
            throw new Error(data?.message || `HTTP ${res.status}`);
        }

        logStatus(`✓ ${path.split("?")[0]}`, false);
        return data;
    } catch (err) {
        logStatus(`✗ ${path}: ${err.message}`, true);
        throw err;
    }
}

function logStatus(message, isError = false) {
    console.log("[LiveTracking]", message);
    const debugPanel = document.getElementById("debugPanel");
    if (debugPanel) {
        const line = document.createElement("div");
        line.className = `debug-panel-line ${isError ? "debug-error" : "debug-info"}`;
        line.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        debugPanel.appendChild(line);
        debugPanel.scrollTop = debugPanel.scrollHeight;
    }
}

/* ===== MAIN INIT ===== */
document.addEventListener("DOMContentLoaded", () => {
    console.log("[LiveTracking] DOM Ready. Initializing...");
    initLiveTracking();
});

async function initLiveTracking() {
    logStatus("Verifying authentication...");
    
    const userObj = JSON.parse(localStorage.getItem("user") || "null");
    let adminId = userObj?.user_id || userObj?.id || localStorage.getItem("user_id");

    if (!adminId) {
        logStatus("Not authenticated. Redirecting...", true);
        console.error("[LiveTracking] No admin ID found. Redirecting to login.");
        setTimeout(() => { window.location.href = "login.html"; }, 1000);
        return;
    }

    console.log("[LiveTracking] Admin ID:", adminId);
    logStatus("Admin ID: " + adminId);
    logStatus("Initializing map...");

    const mapCanvas = document.getElementById("enterpriseMap");
    if (!mapCanvas) {
        logStatus("Map container not found!", true);
        console.error("[LiveTracking] Map canvas #enterpriseMap not found in DOM.");
        return;
    }

    try {
        if (!window.L || !window.L.map) {
            throw new Error("Leaflet library not loaded. Check internet connection.");
        }

        liveMap = L.map(mapCanvas, { zoomControl: false }).setView([20, 78], 5);
        L.control.zoom({ position: "bottomright" }).addTo(liveMap);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 19,
            minZoom: 15,
            className: "map-tiles"
        }).addTo(liveMap);

        console.log("[LiveTracking] Map initialized successfully.");
        logStatus("Map initialized. Fetching live data...");

        await fetchLiveLocations(adminId);
        
        logStatus("Connection established! Syncing every 3s...");
        
        pollInterval = setInterval(() => fetchLiveLocations(adminId), POLL_RATE);
        sendPresenceHeartbeat(adminId);
        setInterval(() => sendPresenceHeartbeat(adminId), 15000);
        
    } catch (err) {
        logStatus(`Init error: ${err.message}`, true);
        console.error("[LiveTracking] Init error:", err);
    }
}

async function fetchLiveLocations(adminId) {
    try {
        const data = await fetchJsonStrict(`/api/admin/live_locations?admin_id=${encodeURIComponent(adminId)}`);
        
        if (!data) {
            throw new Error("Empty response from server");
        }
        
        if (!data.success) {
            throw new Error(data.message || "API returned success: false");
        }

        console.log("[LiveTracking] Data received - Points:", data.map_points?.length || 0, "Target:", data.target);
        logStatus(`Synced ${(data.map_points || []).length} users`);
        
        window.lastReceivedData = data;
        updateDashboardMap(data);
        updateDashboardMetrics(data);
        
    } catch (err) {
        logStatus(`Fetch error: ${err.message}`, true);
        console.error("[LiveTracking] Fetch error:", err.message);
    }
}

function updateDashboardMap(data) {
    if (!data || !data.target) {
        console.warn("[LiveTracking] No target data in response");
        return;
    }

    const center = [data.target.latitude, data.target.longitude];
    lastBounds = { center: center, radius: data.target.radius_m };

    console.log("[LiveTracking] Setting map center to:", center, "with radius:", data.target.radius_m);

    if (!mapCenterMarker) {
        liveMap.setView(center, 18);
        
        mapCenterMarker = L.circleMarker(center, {
            radius: 8,
            fillColor: "#4F46E5",
            color: "#ffffff",
            weight: 3,
            opacity: 1,
            fillOpacity: 1
        }).addTo(liveMap).bindTooltip("Campus Center", { permanent: false });

        mapBoundary = L.circle(center, {
            radius: data.target.radius_m,
            color: "#2563EB",
            weight: 2,
            opacity: 0.8,
            fill: true,
            fillColor: "#EFF6FF",
            fillOpacity: 0.15
        }).addTo(liveMap);
        
        console.log("[LiveTracking] Map markers created.");
    } else {
        mapCenterMarker.setLatLng(center);
        mapBoundary.setLatLng(center);
        mapBoundary.setRadius(data.target.radius_m);
    }

    const stickmanIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/10/10522.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    const stickmanOutIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/10/10522.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
        className: "marker-danger-filter" 
    });
    
    if (!document.getElementById("markerFilterStyles")) {
        const style = document.createElement("style");
        style.id = "markerFilterStyles";
        style.innerHTML = `
            .marker-danger-filter { filter: hue-rotate(300deg) saturate(300%) brightness(120%) contrast(80%) drop-shadow(0 0 6px rgba(239,68,68,0.8)); }
            .leaflet-bottom.leaflet-right { margin-bottom: 24px; margin-right: 24px; }
            @media (max-width: 768px) { .leaflet-bottom.leaflet-right { display: none; } }
        `;
        document.head.appendChild(style);
    }

    const incoming = new Set();
    
    (data.map_points || []).forEach(p => {
        // Only skip from the MAP if we have no valid coordinates to plot
        if (p.latitude == null || p.longitude == null) return;
        if (p.latitude === 0 && p.longitude === 0) return;

        incoming.add(p.user_id);
        const position = [p.latitude, p.longitude];
        
        const inBounds = p.in_bounds;
        const iconToUse = inBounds ? stickmanIcon : stickmanOutIcon;
        
        const hasNetwork = p.device_status && p.device_status.network_on !== false;
        const isStale = p.status === 'STALE' || p.status === 'OFFLINE';
        
        const badgeClass = inBounds ? "safe" : "danger";
        const badgeIcon = inBounds ? "fa-shield-check" : "fa-triangle-exclamation";
        let statusText = inBounds ? "IN BOUNDS" : "OUT OF BOUNDS";
        
        if (isStale || !hasNetwork) {
            statusText = `<b>[OFFLINE]</b> ${statusText}`;
        }
        
        const popupContent = `
            <div class="premium-popup">
                <div class="p-name">${p.name || "Student"}</div>
                <div class="p-badge ${badgeClass}"><i class="fa-solid ${badgeIcon}"></i> ${statusText}</div>
                <div class="p-time">Last update: just now</div>
            </div>
        `;

        if (!mapMarkers[p.user_id]) {
            mapMarkers[p.user_id] = L.marker(position, { icon: iconToUse })
                .addTo(liveMap)
                .bindPopup(popupContent, { autoPanPadding: [30, 30] });
        } else {
            mapMarkers[p.user_id].setLatLng(position);
            mapMarkers[p.user_id].setIcon(iconToUse);
            mapMarkers[p.user_id].setPopupContent(popupContent);
        }
    });

    Object.keys(mapMarkers).forEach(userId => {
        if (!incoming.has(userId)) {
            liveMap.removeLayer(mapMarkers[userId]);
            delete mapMarkers[userId];
        }
    });

    console.log("[LiveTracking] Map updated with", incoming.size, "markers");
}

function updateDashboardMetrics(data) {
    let activeDevices = 0;
    let inside = 0;
    let outside = 0;
    
    const rosterContainer = document.getElementById("activeUserRoster");
    rosterContainer.innerHTML = "";

    (data.map_points || []).forEach(p => {
        // Count ALL users for metrics, not just those with coordinates
        const hasNetwork = p.device_status && p.device_status.network_on !== false;
        const hasLocation = p.device_status && p.device_status.location_on !== false;
        const isStale = p.status === 'STALE' || p.status === 'OFFLINE';

        // A user is "active" (online) if their heartbeat is fresh
        if (hasNetwork && !isStale) {
            activeDevices++;
        }
        
        // Count inside/outside based on their last known location, regardless of offline status
        if (p.in_bounds) {
            inside++;
        } else {
            outside++;
        }

        const isFaulty = !p.in_bounds;
        
        // Apply filter
        if (currentRosterFilter === 'outside' && !isFaulty) return;
        if (currentRosterFilter === 'inside' && isFaulty) return;

        const row = document.createElement("div");
        row.className = `user-row ${isFaulty ? "faulty" : ""}`;
        // If offline, make the row look slightly faded
        if (isStale || !hasNetwork) {
            row.style.opacity = "0.6";
        }
        row.onclick = () => focusOnUser(p.user_id);
        
        const userInitial = (p.name || "U")[0].toUpperCase();
        
        let statusString = isFaulty ? "Out of Campus" : "Inside Campus";
        if (isStale || !hasNetwork) {
            statusString = `<b>[OFFLINE]</b> ${statusString}`;
        }
        
        row.innerHTML = `
            <div class="u-info">
                <div class="u-avatar">${userInitial}</div>
                <div class="u-details">
                    <span class="u-name">${p.name || "Unknown"}</span>
                    <span class="u-status">
                        <div class="status-dot ${isFaulty ? "out" : "in"}"></div>
                        ${statusString}
                    </span>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color: var(--text-tertiary); font-size: 0.8rem;"></i>
        `;
        
        if (isFaulty) {
            rosterContainer.prepend(row);
        } else {
            rosterContainer.appendChild(row);
        }
    });

    if ((data.map_points || []).length === 0) {
        rosterContainer.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); font-size: 0.85rem; padding: 20px;">No users currently being tracked</div>`;
    } else if (rosterContainer.childElementCount === 0) {
        rosterContainer.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); font-size: 0.85rem; padding: 20px;">No users match the selected filter</div>`;
    }

    const valOutside = document.getElementById("valOutside");
    if (valOutside) valOutside.textContent = outside;
    
    const valInside = document.getElementById("valInside");
    if (valInside) valInside.textContent = inside;
    
    document.getElementById("rosterCount").textContent = `${activeDevices} Online`;
    document.getElementById("lastUpdatedStr").textContent = new Date().toLocaleTimeString([], {hour: "2-digit", minute:"2-digit", second:"2-digit"});
    
    const outsideCard = document.getElementById("cardViolations");
    if (outsideCard) {
        if (outside > 0) {
            outsideCard.style.display = "flex";
        } else {
            outsideCard.style.display = "none";
        }
    }

    console.log("[LiveTracking] Metrics updated - Active:", activeDevices, "Inside:", inside, "Outside:", outside);
}

function focusOnCampus() {
    if (lastBounds && lastBounds.center && liveMap) {
        console.log("[LiveTracking] Focusing on campus center");
        liveMap.flyTo(lastBounds.center, 18, { animate: true, duration: 1.2 });
    }
}

function focusOnUser(userId) {
    if (mapMarkers[userId] && liveMap) {
        console.log("[LiveTracking] Focusing on user:", userId);
        const marker = mapMarkers[userId];
        liveMap.flyTo(marker.getLatLng(), 19, { animate: true, duration: 1.0 });
        marker.openPopup();
    }
}

function sendPresenceHeartbeat(adminId) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            await fetchJsonStrict(`/api/location_heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: adminId,
                    // FIXED: Do NOT send network_on/location_on — native service handles truth
                    device_status: {},
                    location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
                })
            });
        } catch (err) {
            console.warn("[LiveTracking] Heartbeat failed (not critical):", err.message);
        }
    }, null, { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 });
}

window.addEventListener("beforeunload", () => {
    if (pollInterval) clearInterval(pollInterval);
});

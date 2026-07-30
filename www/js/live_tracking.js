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

    let online = 0;
    let offline = 0;
    let gpsOff = 0;
    let mockLoc = 0;
    let lowBatt = 0;
    let stopped = 0;

    const allUsers = [...(data.map_points || []), ...(data.inactive_users || [])];

    allUsers.forEach(p => {
        // A user is "online" if their presence_state is ONLINE and network is active
        const hasNetwork = p.device_status && p.device_status.network_on !== false;
        
        if (hasNetwork && p.presence_state === 'ONLINE') {
            online++;
        } else {
            offline++;
        }

        // Count inside/outside based on their location_state
        if (p.location_state === 'INSIDE_CAMPUS') {
            inside++;
        } else if (p.location_state === 'OUTSIDE_CAMPUS' || p.location_state === 'OUT_OF_GEOFENCE') {
            outside++;
        }

        if (p.device_state === 'GPS_OFF') gpsOff++;
        if (p.device_state === 'MOCK_LOCATION') mockLoc++;
        if (p.device_state === 'LOW_BATTERY') lowBatt++;
        if (p.tracking_status === 'STOPPED' || p.tracking_status === 'PAUSED') stopped++;

        const isStale = !hasNetwork || p.presence_state === 'OFFLINE';
        const isFaulty = p.location_state === 'OUTSIDE_CAMPUS' || p.device_state === 'MOCK_LOCATION' || p.device_state === 'GPS_OFF';
        
        // Apply filter
        if (currentRosterFilter === 'outside' && p.location_state !== 'OUTSIDE_CAMPUS' && p.location_state !== 'OUT_OF_GEOFENCE') return;
        if (currentRosterFilter === 'inside' && p.location_state !== 'INSIDE_CAMPUS') return;
        if (currentRosterFilter === 'offline' && !isStale) return;
        if (currentRosterFilter === 'gps_off' && p.device_state !== 'GPS_OFF') return;
        if (currentRosterFilter === 'mock' && p.device_state !== 'MOCK_LOCATION') return;
        if (currentRosterFilter === 'battery' && p.device_state !== 'LOW_BATTERY') return;
        if (currentRosterFilter === 'stopped' && p.tracking_status !== 'STOPPED' && p.tracking_status !== 'PAUSED') return;

        const row = document.createElement("div");
        row.className = `user-row ${isFaulty ? "faulty" : ""}`;
        // If offline, make the row look slightly faded
        if (isStale || !hasNetwork || p.status === 'OFFLINE') {
            row.style.opacity = "0.6";
        }
        
        // Let's store stringified data in dataset so we can pull it in the profile overlay
        row.dataset.profileStr = JSON.stringify(p);
        
        row.onclick = () => {
            openProfileOverlay(p);
        };
        
        const userInitial = (p.name || "U")[0].toUpperCase();
        
        let statusString = p.location_state || 'UNKNOWN';
        if (p.location_state === 'INSIDE_CAMPUS') statusString = "Inside Campus";
        else if (p.location_state === 'OUTSIDE_CAMPUS' || p.location_state === 'OUT_OF_GEOFENCE') statusString = "Out of Campus";
        else if (p.location_state === 'UNKNOWN') statusString = "Locating...";
        
        if (p.activity_state === 'LUNCH_BREAK') statusString += " (Lunch Break)";
        
        if (p.presence_state === 'OFFLINE') statusString = "Offline";
        
        if (p.device_state === 'GPS_OFF') statusString = "GPS Disabled";
        else if (p.device_state === 'MOCK_LOCATION') statusString = "Mock Location";
        else if (p.tracking_status === 'STOPPED') statusString = `Stopped (${p.pause_reason || 'Unknown'})`;
        
        if (!hasNetwork && p.presence_state !== 'OFFLINE') {
            statusString = `<b>[STALE]</b> ${statusString}`;
        }
        
        row.innerHTML = `
            <div class="u-info" style="flex: 1; min-width: 0;">
                <div class="u-avatar">${userInitial}</div>
                <div class="u-details" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1;">
                    <span class="u-name" style="display: block; overflow: hidden; text-overflow: ellipsis;">${p.name || "Unknown"}</span>
                    <span class="u-status">
                        <div class="status-dot ${p.status === 'OFFLINE' || isStale || !hasNetwork ? "gray" : (isFaulty ? "out" : "in")}"></div>
                        ${statusString}
                    </span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; margin-left: 12px; flex-shrink: 0;">
                <div title="Locate on map" onclick="event.stopPropagation(); focusOnUser('${p.user_id}');" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(37,99,235,0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;">
                    <i class="fa-solid fa-location-crosshairs"></i>
                </div>
                <i class="fa-solid fa-chevron-right" style="color: var(--text-tertiary); font-size: 0.8rem;"></i>
            </div>
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

    if (document.getElementById("valOnline")) document.getElementById("valOnline").textContent = online;
    if (document.getElementById("valOffline")) document.getElementById("valOffline").textContent = offline;
    if (document.getElementById("valOutside")) document.getElementById("valOutside").textContent = outside;
    if (document.getElementById("valInside")) document.getElementById("valInside").textContent = inside;
    if (document.getElementById("valGpsOff")) document.getElementById("valGpsOff").textContent = gpsOff;
    if (document.getElementById("valMock")) document.getElementById("valMock").textContent = mockLoc;
    if (document.getElementById("valBattery")) document.getElementById("valBattery").textContent = lowBatt;
    if (document.getElementById("valStopped")) document.getElementById("valStopped").textContent = stopped;
    
    document.getElementById("rosterCount").textContent = `${online} Online`;
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
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    gps_accuracy: pos.coords.accuracy
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

// === Profile Slider Logic ===

function openProfileOverlay(p) {
    // Pan the map to the user's location if available
    if (p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0 && liveMap) {
        liveMap.flyTo([p.latitude, p.longitude], 17, { duration: 1.5 });
    }

    document.getElementById("profName").textContent = p.name || "Unknown";
    document.getElementById("profId").textContent = p.user_id;
    document.getElementById("profRole").textContent = p.role || "User";
    
    // Avatar
    const userInitial = (p.name || "U")[0].toUpperCase();
    document.getElementById("profAvatar").textContent = userInitial;
    
    // Network & Battery
    const hasNetwork = p.device_status && p.device_status.network_on !== false;
    let netText = (p.device_status && p.device_status.network_type) ? p.device_status.network_type : (hasNetwork ? "Connected" : "Offline");
    if (!hasNetwork && p.device_status && p.device_status.network_type) {
        netText += " (Offline)";
    }
    document.getElementById("profNetwork").textContent = netText;
    document.getElementById("profNetwork").style.color = hasNetwork ? "#0f172a" : "#ef4444";
    
    if (p.device_status && p.device_status.battery_level !== undefined && p.device_status.battery_level !== null) {
        document.getElementById("profBattery").textContent = `🔋 ${p.device_status.battery_level}%`;
    } else {
        document.getElementById("profBattery").textContent = "N/A";
    }

    // Location & App
    if (p.device_status && p.device_status.gps_accuracy !== undefined && p.device_status.gps_accuracy !== null) {
        let gpsText = `±${Math.round(p.device_status.gps_accuracy)}m`;
        if (p.device_status.location_on === false) gpsText += " (Disabled)";
        document.getElementById("profGps").textContent = gpsText;
    } else {
        document.getElementById("profGps").textContent = p.device_status && p.device_status.location_on === false ? "Disabled" : "N/A";
    }
    
    if (p.tracking_status === 'STOPPED' || p.status === 'OFFLINE') {
        document.getElementById("profAppState").innerHTML = `<span style="color:#ef4444;font-weight:700;">STOPPED</span>`;
    } else {
        document.getElementById("profAppState").innerHTML = `<span style="color:#10b981;font-weight:700;">ACTIVE</span>`;
    }
    
    // Last Seen
    if (p.last_seen) {
        document.getElementById("profLastSeen").textContent = convertUTCtoIST(p.last_seen);
    } else {
        document.getElementById("profLastSeen").textContent = "No record";
    }

    // Bounds Status
    if (p.in_bounds === false) {
        document.getElementById("profPhysical").innerHTML = `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:700;">OUT OF BOUNDS</span>`;
    } else if (p.in_bounds === true) {
        document.getElementById("profPhysical").innerHTML = `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:700;">IN BOUNDS</span>`;
    } else {
        document.getElementById("profPhysical").textContent = "N/A";
    }

    // Attendance & Permissions
    if (p.today_attendance) {
        document.getElementById("profTimeIn").textContent = p.today_attendance.time_in ? p.today_attendance.time_in : "--";
        document.getElementById("profTimeOut").textContent = p.today_attendance.time_out ? p.today_attendance.time_out : "--";
    } else {
        document.getElementById("profTimeIn").textContent = "--";
        document.getElementById("profTimeOut").textContent = "--";
    }

    document.getElementById("profPerms").textContent = p.today_permission ? p.today_permission : "None";

    const overlay = document.getElementById("profileOverlay");
    overlay.style.display = "block";
    
    // trigger reflow
    void overlay.offsetWidth;
    
    overlay.classList.add("active");
}

function closeProfile() {
    const overlay = document.getElementById("profileOverlay");
    overlay.classList.remove("active");
    setTimeout(() => {
        overlay.style.display = "none";
    }, 300); // Wait for transition
}

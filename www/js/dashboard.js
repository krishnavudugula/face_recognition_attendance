document.addEventListener('DOMContentLoaded', () => {
    // Determine which dashboard we are on
    const path = window.location.pathname;
    const pendingFaceUser = JSON.parse(localStorage.getItem('pending_face_user') || 'null');

    if (pendingFaceUser) {
        window.location.href = 'capture_face.html';
        return;
    }
    
    if (path.includes('admin_dashboard.html')) {
        initAdminDashboard();
    } else if (path.includes('faculty_dashboard.html')) {
        initFacultyDashboard();
    }
});

let allPermissionRows = [];

async function initAdminDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Check if user is logged in
    if (!user || user.role !== 'admin') {
        console.warn("Unauthorized Access: user not found or not admin. Redirecting to login.");
        window.location.href = 'login.html';
        return;
    }

    // Use a valid user ID if logged in, or a default for dev if backend supports it
    const userId = user ? user.id : 'ADMIN01'; 

    try {
        const response = await fetch(`/api/dashboard/admin/${userId}`);
        // Check if response is ok
        if (!response.ok) {
             throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        // Update Stats using specific IDs (More robust)
        const totalEl = document.getElementById('statTotalStaff');
        const presentEl = document.getElementById('statPresent');
        const lateEl = document.getElementById('statLate');
        const absentEl = document.getElementById('statAbsent');

        if (totalEl) totalEl.textContent = data.stats.total_users || 0;
        if (presentEl) presentEl.textContent = data.stats.present_today || 0;
        if (lateEl) lateEl.textContent = data.stats.late_count || 0;
        if (absentEl) absentEl.textContent = data.stats.absent_count || 0;
        
        // Populate Table
        const tbody = document.getElementById('attendanceTableBody');
        if (!tbody) {
            console.error("Table body 'attendanceTableBody' not found!");
            return;
        }
        
        tbody.innerHTML = '';
        
        if (!data.logs || data.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No activity today.</td></tr>';
        } else {
            data.logs.forEach(log => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${log.id}</td>
                    <td>${log.name}</td>
                    <td>${log.role}</td>
                    <td>${log.date}</td>
                    <td>${log.time_in || '--:--'}</td>
                    <td>${log.time_out || '--:--'}</td>
                    <td><span class="status-pill ${getStatusClass(log.status)}">${log.status || 'Marked'}</span></td>
                    <td>
                         <!-- Action buttons placeholder -->
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

    } catch (error) {
        console.error("Failed to load admin dashboard:", error);
    } finally {
        initializePermissionCenter(userId);
    }
}

function initializePermissionCenter(adminId) {
    const createForm = document.getElementById('permissionCreateForm');
    const dateInput = document.getElementById('permDate');
    const statusFilter = document.getElementById('permFilterStatus');
    const typeFilter = document.getElementById('permFilterType');
    const userFilter = document.getElementById('permFilterUserId');
    const dateFilter = document.getElementById('permFilterDate');
    const windowFilter = document.getElementById('permFilterWindow');
    const permissionTableBody = document.getElementById('permissionTableBody');
    const windowMode = document.getElementById('permWindowMode');

    if (!createForm || !permissionTableBody) {
        return;
    }

    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    createForm.addEventListener('submit', (event) => {
        event.preventDefault();
        createPermissionFromForm(adminId);
    });

    if (windowMode) {
        windowMode.addEventListener('change', updatePermissionWindowInputs);
        updatePermissionWindowInputs();
    }

    [statusFilter, typeFilter, userFilter, dateFilter, windowFilter].forEach((el) => {
        if (!el) return;
        el.addEventListener('input', () => applyPermissionFilters());
        el.addEventListener('change', () => applyPermissionFilters());
    });

    permissionTableBody.addEventListener('click', async (event) => {
        const actionBtn = event.target.closest('button[data-perm-action]');
        if (!actionBtn) return;

        const permissionId = actionBtn.getAttribute('data-perm-id');
        const action = actionBtn.getAttribute('data-perm-action');
        if (!permissionId || !action) return;

        if (action === 'Delete') {
            const confirmation = confirm(`Are you sure you want to permanently delete permission #${permissionId}? This action cannot be undone.`);
            if (!confirmation) return;
            
            await deletePermission(adminId, permissionId);
        } else {
            // Approve or Reject
            const confirmation = confirm(`Mark permission #${permissionId} as ${action}?`);
            if (!confirmation) return;

            const adminReason = prompt('Optional admin note (reason for decision):', '') || '';
            await decidePermission(adminId, permissionId, action, adminReason);
        }
    });

    fetchPermissions(adminId);
}

function updatePermissionWindowInputs() {
    const mode = (document.getElementById('permWindowMode')?.value || 'TIME_RANGE').trim();
    const start = document.getElementById('permStartTime');
    const end = document.getElementById('permEndTime');
    const customWrap = document.getElementById('permCustomDaysWrap');

    if (!start || !end || !customWrap) return;

    if (mode === 'FULL_DAY') {
        start.disabled = true;
        end.disabled = true;
        start.value = '';
        end.value = '';
        customWrap.style.display = 'none';
    } else if (mode === 'CUSTOM_DAYS') {
        start.disabled = false;
        end.disabled = false;
        customWrap.style.display = 'block';
    } else {
        start.disabled = false;
        end.disabled = false;
        customWrap.style.display = 'none';
    }
}

async function fetchPermissions(adminId) {
    try {
        const response = await fetch(`/api/admin/permissions?admin_id=${encodeURIComponent(adminId)}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to load permissions.');
        }

        allPermissionRows = Array.isArray(result.permissions) ? result.permissions : [];
        renderPermissionSummary(allPermissionRows);
        applyPermissionFilters();
    } catch (error) {
        console.error('Permission fetch error:', error);
        showPermissionFlash(error.message || 'Failed to load permissions.', 'error');
    }
}

function renderPermissionSummary(rows) {
    const total = rows.length;
    const pending = rows.filter((row) => row.status === 'Pending').length;
    const approved = rows.filter((row) => row.status === 'Approved').length;
    const rejected = rows.filter((row) => row.status === 'Rejected').length;

    const totalEl = document.getElementById('permStatTotal');
    const pendingEl = document.getElementById('permStatPending');
    const approvedEl = document.getElementById('permStatApproved');
    const rejectedEl = document.getElementById('permStatRejected');

    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (approvedEl) approvedEl.textContent = approved;
    if (rejectedEl) rejectedEl.textContent = rejected;
}

function applyPermissionFilters() {
    const statusFilter = (document.getElementById('permFilterStatus')?.value || '').trim();
    const typeFilter = (document.getElementById('permFilterType')?.value || '').trim().toUpperCase();
    const userFilter = (document.getElementById('permFilterUserId')?.value || '').trim().toLowerCase();
    const dateFilter = (document.getElementById('permFilterDate')?.value || '').trim();
    const windowFilter = (document.getElementById('permFilterWindow')?.value || '').trim();

    const filtered = allPermissionRows.filter((row) => {
        const statusOk = !statusFilter || row.status === statusFilter;
        const typeOk = !typeFilter || (row.type || '').toUpperCase() === typeFilter;
        const userOk = !userFilter || (row.user_id || '').toLowerCase().includes(userFilter);
        const dateOk = !dateFilter || row.date === dateFilter;
        const mode = getPermissionWindowMode(row);
        const windowOk = !windowFilter || mode === windowFilter;
        return statusOk && typeOk && userOk && dateOk && windowOk;
    });

    renderPermissionTable(filtered);
}

function renderPermissionTable(rows) {
    const tbody = document.getElementById('permissionTableBody');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.6rem !important; color:#64748b;">No permissions match this filter.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((row) => {
        const statusClass = getStatusClass(row.status);
        const isPending = row.status === 'Pending';
        const safeReason = row.reason ? escapeHtml(row.reason) : '-';
        const permissionType = formatPermissionType(row.type);
        const statusLabel = formatStatusLabel(row.status || '-');
        return `
            <tr>
                <td>${row.id}</td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:0.1rem;">
                        <span style="font-weight:700; color:#0f172a;">${escapeHtml(row.name || row.user_id)}</span>
                        <span style="font-size:0.78rem; color:#64748b;">${escapeHtml(row.user_id || '')}</span>
                    </div>
                </td>
                <td>
                    <span class="permission-type-chip ${row.type === 'LP' ? 'lp' : 'ep'}">${permissionType}</span>
                </td>
                <td>${escapeHtml(row.date || '-')}</td>
                <td style="min-width: 180px;">${escapeHtml(getPermissionWindowLabel(row))}</td>
                <td style="max-width: 360px; white-space: normal;">${safeReason}</td>
                <td><span class="status-pill ${statusClass}">${escapeHtml(statusLabel)}</span></td>
                <td style="text-align:right; padding-right:0.75rem;">
                    ${isPending ? `
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; justify-content:flex-end; align-items:center;">
                        <button data-perm-action="Approved" data-perm-id="${row.id}" class="action-btn-primary" style="padding:0.4rem 0.65rem; font-size:0.85rem; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center;" title="Approve">
                            <i class="fa-solid fa-check" style="color:white;"></i>
                        </button>
                        <button data-perm-action="Rejected" data-perm-id="${row.id}" class="action-btn-danger" style="padding:0.4rem 0.65rem; font-size:0.85rem; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center;" title="Reject">
                            <i class="fa-solid fa-xmark" style="color:white;"></i>
                        </button>
                        <button data-perm-action="Delete" data-perm-id="${row.id}" class="action-btn-danger" style="padding:0.4rem 0.65rem; font-size:0.85rem; background-color: #ef4444 !important; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center;" title="Delete">
                            <i class="fa-solid fa-trash" style="color:white;"></i>
                        </button>
                    </div>
                    ` : `
                    <button data-perm-action="Delete" data-perm-id="${row.id}" class="action-btn-danger" style="padding:0.4rem 0.65rem; font-size:0.85rem; background-color: #ef4444 !important; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center;" title="Delete Permission">
                        <i class="fa-solid fa-trash" style="color:white;"></i>
                    </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

async function createPermissionFromForm(adminId) {
    const userId = (document.getElementById('permUserId')?.value || '').trim();
    const type = (document.getElementById('permType')?.value || '').trim();
    const date = (document.getElementById('permDate')?.value || '').trim();
    const reason = (document.getElementById('permReason')?.value || '').trim();
    const status = (document.getElementById('permDefaultStatus')?.value || 'Pending').trim();
    const windowMode = (document.getElementById('permWindowMode')?.value || 'TIME_RANGE').trim();
    const startTime = (document.getElementById('permStartTime')?.value || '').trim();
    const endTime = (document.getElementById('permEndTime')?.value || '').trim();
    const customDays = (document.getElementById('permCustomDays')?.value || '').trim();

    if (!userId || !type || !date) {
        showPermissionFlash('Faculty ID, type, and date are required.', 'error');
        return;
    }

    if (windowMode !== 'FULL_DAY' && (!startTime || !endTime)) {
        showPermissionFlash('Start and end time are required for timed permissions.', 'error');
        return;
    }

    if (windowMode !== 'FULL_DAY' && endTime <= startTime) {
        showPermissionFlash('End time must be later than start time.', 'error');
        return;
    }

    if (windowMode === 'CUSTOM_DAYS' && !customDays) {
        showPermissionFlash('Provide custom days in YYYY-MM-DD format (comma-separated).', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/permissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: adminId,
                user_id: userId,
                type,
                date,
                start_time: windowMode === 'FULL_DAY' ? null : startTime,
                end_time: windowMode === 'FULL_DAY' ? null : endTime,
                is_full_day: windowMode === 'FULL_DAY',
                custom_days: windowMode === 'CUSTOM_DAYS' ? customDays : '',
                reason,
                status
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to create permission.');
        }

        const form = document.getElementById('permissionCreateForm');
        if (form) form.reset();
        const dateInput = document.getElementById('permDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        showPermissionFlash('Permission saved successfully.', 'success');
        fetchPermissions(adminId);
    } catch (error) {
        console.error('Create permission error:', error);
        showPermissionFlash(error.message || 'Failed to save permission.', 'error');
    }
}

function getPermissionWindowMode(row) {
    if (row?.is_full_day) return 'FULL_DAY';
    if (row?.custom_days && String(row.custom_days).trim()) return 'CUSTOM_DAYS';
    return 'TIME_RANGE';
}

function getPermissionWindowLabel(row) {
    const mode = getPermissionWindowMode(row);
    if (mode === 'FULL_DAY') return 'Full Day';
    if (mode === 'CUSTOM_DAYS') {
        const timePart = row?.start_time && row?.end_time ? ` (${row.start_time}-${row.end_time})` : '';
        return `Custom Days${timePart}`;
    }
    if (row?.start_time && row?.end_time) return `${row.start_time} - ${row.end_time}`;
    return 'Time Not Set';
}

async function decidePermission(adminId, permissionId, decision, decisionReason) {
    try {
        const response = await fetch(`/api/admin/permissions/${permissionId}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: adminId,
                decision,
                decision_reason: decisionReason
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to update decision.');
        }

        showPermissionFlash(`Permission #${permissionId} ${decision.toLowerCase()}.`, 'success');
        fetchPermissions(adminId);
    } catch (error) {
        console.error('Permission decision error:', error);
        showPermissionFlash(error.message || 'Failed to update permission decision.', 'error');
    }
}

async function deletePermission(adminId, permissionId) {
    try {
        const response = await fetch(`/api/admin/permissions/${permissionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: adminId
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to delete permission.');
        }

        showPermissionFlash(`Permission #${permissionId} deleted successfully.`, 'success');
        fetchPermissions(adminId);
    } catch (error) {
        console.error('Permission delete error:', error);
        showPermissionFlash(error.message || 'Failed to delete permission.', 'error');
    }
}

function showPermissionFlash(message, type = 'success') {
    const flash = document.getElementById('permFlash');
    if (!flash) return;

    flash.style.display = 'inline-flex';
    flash.style.alignItems = 'center';
    flash.style.gap = '0.5rem';
    flash.textContent = message;

    if (type === 'success') {
        flash.style.background = '#dcfce7';
        flash.style.color = '#166534';
        flash.style.border = '1px solid #86efac';
    } else {
        flash.style.background = '#fee2e2';
        flash.style.color = '#991b1b';
        flash.style.border = '1px solid #fca5a5';
    }

    window.clearTimeout(flash._timer);
    flash._timer = window.setTimeout(() => {
        flash.style.display = 'none';
    }, 3200);
}

function escapeHtml(input) {
    const raw = String(input || '');
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function initFacultyDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Check if we are viewing as Admin
    const urlParams = new URLSearchParams(window.location.search);
    const viewUserId = urlParams.get('view_user'); 
    
    let targetUserId = user ? user.id : null;
    let isViewer = false;

    if (viewUserId) {
        // Admin viewing someone else
        const adminUser = JSON.parse(localStorage.getItem('user'));
        if (!adminUser || adminUser.role !== 'admin') {
            alert("Unauthorized View");
            window.location.href = 'login.html';
            return;
        }
        targetUserId = viewUserId;
        isViewer = true;
    } else if (!user) {
        // Not logged in at all
        window.location.href = 'login.html';
        return;
    }

    // Start background location tracking for faculty users (not for admins viewing)
    if (!isViewer && user && user.role === 'faculty') {
        console.log('[Dashboard] Starting background location tracking for faculty...');
        if (window.startLocationTracking) {
            try {
                await window.startLocationTracking();
                console.log('[Dashboard] ✅ Background location tracking started');
                
                // Show tracking status badge
                const trackingBadge = document.getElementById('trackingStatusBadge');
                if (trackingBadge) {
                    trackingBadge.style.display = 'inline-flex';
                    trackingBadge.title = '📍 Location tracking is ACTIVE and PERSISTENT\n✓ Will survive force-close\n✓ Will survive cache clear\n✓ Will restart after reboot';
                    console.log('[Dashboard] 📍 Tracking status badge displayed');
                }
                
                // Verify notification persistence
                if (window.verifyNotificationPersistence) {
                    window.verifyNotificationPersistence();
                }
            } catch (e) {
                console.error('[Dashboard] Failed to start tracking:', e);
            }
        }
    } else if (user && user.role === 'faculty') {
        // Even when viewing as admin, hide the tracking badge for clarity
        const trackingBadge = document.getElementById('trackingStatusBadge');
        if (trackingBadge) {
            trackingBadge.style.display = 'none';
        }
    }

    // Set Initial User Info (if viewing self)
    if (!isViewer && user) {
        const nameEl = document.getElementById('facultyName');
        const roleEl = document.getElementById('facultyDept');
        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    }

    try {
        // Fetch viewed user's details if in viewer mode
        if (isViewer) {
            const userDetailsResponse = await fetch(`/api/users/${targetUserId}`);
            const userDetailsData = await userDetailsResponse.json();
            if (userDetailsData.success && userDetailsData.user) {
                document.getElementById('facultyName').textContent = userDetailsData.user.name;
                document.getElementById('facultyDept').textContent = userDetailsData.user.role.charAt(0).toUpperCase() + userDetailsData.user.role.slice(1);
            }
        }

        const response = await fetch(`/api/dashboard/faculty/${targetUserId}`);
        const data = await response.json();
        
        // Hide Scan Button for non-owner viewing
        if (isViewer) {
            const scanBtn = document.querySelector('a[href="scan.html"]');
            if(scanBtn) scanBtn.style.display = 'none';
        }

        // --- Update Status Cards ---
        const todayDateEl = document.getElementById('todayDate');
        const checkInTimeEl = document.getElementById('checkInTime');
        const checkOutTimeEl = document.getElementById('checkOutTime');
        const statusEl = document.getElementById('todayStatus');

        if (todayDateEl) {
            todayDateEl.textContent = new Date().toLocaleDateString('en-US', { 
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
            });
        }

        if (checkInTimeEl) {
            checkInTimeEl.textContent = data.last_check_in || "--:--";
            checkInTimeEl.style.color = (data.last_check_in && data.last_check_in !== '--:--') ? 'var(--success-color)' : '#64748b';
        }

        if (checkOutTimeEl) {
            checkOutTimeEl.textContent = data.last_check_out || "--:--";
            checkOutTimeEl.style.color = (data.last_check_out && data.last_check_out !== '--:--') ? 'var(--warning-color)' : '#64748b';
        }

        if (statusEl) {
            const status = data.current_status || "Not Marked";
            const normalizedCurrentStatus = formatStatusLabel(status);
            statusEl.textContent = normalizedCurrentStatus;
            
            // Color logic
            const statusLower = normalizedCurrentStatus.toLowerCase();
            if (statusLower.includes('present') || statusLower.includes('on time') || statusLower.includes('checked in')) statusEl.style.color = 'var(--success-color)';
            else if (statusLower.includes('late') || statusLower.includes('early')) statusEl.style.color = 'var(--warning-color)';
            else if (statusLower.includes('absent') || statusLower.includes("didn't mark")) statusEl.style.color = 'var(--danger-color)';
            else statusEl.style.color = 'var(--text-secondary)';
        }

        // --- Update History Table ---
        const tbody = document.getElementById('myAttendanceHistory');
        if (tbody) {
            tbody.innerHTML = '';
            
            if (!data.logs || data.logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No attendance history found.</td></tr>';
            } else {
                data.logs.forEach(log => {
                    const row = document.createElement('tr');
                    const normalizedLogStatus = formatStatusLabel(log.status || 'Not Marked');
                    
                    let statusClass = 'status-present';
                    const statusText = normalizedLogStatus.toLowerCase();
                    if (statusText.includes('absent') || statusText.includes("didn't mark")) statusClass = 'status-absent';
                    if (statusText.includes('late') || statusText.includes('early')) statusClass = 'status-late';

                    row.innerHTML = `
                        <td>${log.date}</td>
                        <td style="font-weight: 500;">${log.time_in || '--:--'}</td>
                        <td style="color: #64748b;">${log.time_out || '--:--'}</td>
                        <td>${log.duration || '-'}</td> <!-- Backend not yet computing duration, need update if required -->
                        <td><span class="status-pill ${statusClass}">${normalizedLogStatus}</span></td>
                    `;
                    tbody.appendChild(row);
                });
            }
        }

    } catch (error) {
        console.error("Failed to load faculty dashboard:", error);
    }
}

function getStatusClass(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('approved') || s.includes('on time') || s.includes('checked in') || s.includes('checked out')) return 'status-present';
    if (s.includes('pending')) return 'status-late';
    if (s.includes('rejected')) return 'status-absent';
    if (s.includes('late')) return 'status-late';
    if (s.includes('early')) return 'status-late'; // Orange for early too
    if (s.includes('granted') || s.includes('on-time')) return 'status-present';
    if (s.includes("didn't mark") || s.includes('absent')) return 'status-absent';
    return 'status-absent';
}

function formatPermissionType(type) {
    const t = String(type || '').trim().toUpperCase();
    if (t === 'LP') return 'Late Arrival';
    if (t === 'EP') return 'Early Exit';
    return t || '-';
}

function formatStatusLabel(status) {
    const value = String(status || '').trim();
    const normalized = value.toLowerCase().replace(/[_-]+/g, ' ');
    const map = {
        'on time': 'On Time',
        'on-time': 'On Time',
        'late permission': 'Late Permission',
        'early departure': 'Early Departure',
        "didn't mark": "Didn't Mark",
        'not marked': 'Not Marked',
        'checked in': 'Checked In',
        'checked out': 'Checked Out',
        'present': 'Present',
        'late': 'Late',
        'absent': 'Absent',
        'pending': 'Pending',
        'approved': 'Approved',
        'rejected': 'Rejected'
    };

    return map[normalized] || value || '-';
}

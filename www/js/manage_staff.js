document.addEventListener('DOMContentLoaded', () => {
    fetchUsers();

    const searchInput = document.getElementById('searchStaff');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = String(e.target.value || '').trim().toLowerCase();
            const rows = document.querySelectorAll('#staffTableBody tr[data-user-row="true"]');

            rows.forEach((row) => {
                const searchText = String(row.dataset.search || '').toLowerCase();
                row.style.display = !query || searchText.includes(query) ? '' : 'none';
            });
        });
    }
});

async function fetchUsers() {
    const tableBody = document.getElementById('staffTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading staff records...</td></tr>';

    try {
        const response = await fetch('/api/users');
        const users = await response.json();

        tableBody.innerHTML = '';

        if (!Array.isArray(users) || users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No staff found.</td></tr>';
            return;
        }

        users.forEach((user) => {
            const row = document.createElement('tr');
            row.setAttribute('data-user-row', 'true');
            row.dataset.search = `${user.id || ''} ${user.name || ''} ${user.role || ''} ${user.status || ''}`;
            row.innerHTML = `
                <td class="staff-id-cell" data-label="Staff ID">${escapeHtml(user.id || '-')}</td>
                <td class="staff-name-cell" data-label="Name">${escapeHtml(user.name || '-')}</td>
                <td class="staff-role-cell" data-label="Role">${escapeHtml(formatRole(user.role || '-'))}</td>
                <td class="staff-status-cell" data-label="Status"><span class="status-pill ${getStatusClass(user.status)}">${escapeHtml(formatStatus(user.status))}</span></td>
                <td class="staff-actions-cell" data-label="Actions">${getActionButtons(user)}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: #dc2626;">Failed to load staff records.</td></tr>';
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getInitial(name) {
    return String(name || 'U').trim().charAt(0).toUpperCase() || 'U';
}

function formatRole(role) {
    const value = String(role || '').trim().toLowerCase();
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '-';
}

function formatStatus(status) {
    const value = String(status || '').trim();
    if (!value) return 'Absent';
    return value === "Didn't Mark" ? "Didn't Mark" : value;
}

function getStatusClass(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'present' || normalized === 'on-time' || normalized === 'on time') return 'status-present';
    if (normalized === "didn't mark" || normalized === 'absent') return 'status-absent';
    if (normalized === 'late' || normalized === 'late permission' || normalized === 'early permission' || normalized === 'hd') return 'status-late';
    return '';
}

function getActionButtons(user) {
    if (String(user.role || '').toLowerCase() === 'admin') return '<span class="text-muted">Protected</span>';

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminId = currentUser.user_id || currentUser.id || 'ADMIN01';
    const safeId = escapeHtml(user.id || '');
    const safeName = escapeHtml(user.name || '');

    return `
        <div class="staff-action-cluster">
            <button class="icon-btn staff-view-btn" onclick="viewUserLogs('${safeId}')" title="View profile">
                <i class="fa-solid fa-eye"></i>
            </button>
            <button class="icon-btn danger-btn" onclick="markUserAbsent('${safeId}', '${safeName}', '${escapeHtml(adminId)}')" title="Mark as Didn't Mark">
                <i class="fa-solid fa-user-slash"></i>
            </button>
            <button class="icon-btn danger-btn" onclick="deleteUser('${safeId}')" title="Delete staff member">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
}

function viewUserLogs(userId) {
    window.location.href = `/pages/faculty_dashboard.html?view_user=${encodeURIComponent(userId)}`;
}

async function markUserAbsent(userId, userName, adminId) {
    if (!confirm(`Mark ${userName} as "Didn't Mark" for today?`)) {
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch('/api/mark_absent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                date: today,
                admin_id: adminId
            })
        });

        const result = await response.json();
        if (result.success) {
            alert(`${userName} marked as "Didn't Mark" for today.`);
            fetchUsers();
        } else {
            alert('Error marking user: ' + result.message);
        }
    } catch (error) {
        console.error('Mark absent failed:', error);
        alert('Server error. Please try again.');
    }
}

async function deleteUser(userId) {
    if (!confirm(`Are you sure you want to permanently delete user ${userId}? This removes their attendance history too.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            alert('User deleted successfully.');
            fetchUsers();
        } else {
            alert('Error deleting user: ' + result.message);
        }
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Server error during deletion.');
    }
}

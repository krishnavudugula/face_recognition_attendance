document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const userRole = localStorage.getItem('user_role');
    const adminId = localStorage.getItem('user_id');
    
    if (userRole !== 'admin' && userRole !== 'faculty') {
        window.location.href = 'login.html';
        return;
    }

    if (userRole === 'faculty') {
        // Remove Admin Badges completely
        const adminBadges = document.getElementById('adminActionBadges');
        if (adminBadges) adminBadges.remove();
        
        // Remove Action Column Header
        const actionHeader = document.getElementById('actionColumnHeader');
        if (actionHeader) actionHeader.remove();

        // Fix empty state text for faculty
        const emptyStateDesc = document.getElementById('emptyStateDesc');
        if (emptyStateDesc) emptyStateDesc.textContent = "There are no upcoming holidays declared yet.";
    }

    loadHolidays();
});

let currentHolidays = [];

async function loadHolidays() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/admin/holidays`);
        if (!response.ok) throw new Error('Failed to fetch holidays');
        
        const data = await response.json();
        currentHolidays = data.holidays || [];
        renderHolidaysTable();
    } catch (error) {
        console.error('Error loading holidays:', error);
        showToast('Error loading holidays', 'error');
    }
}

function renderHolidaysTable() {
    const tableBody = document.getElementById('holidaysTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (currentHolidays.length === 0) {
        tableBody.innerHTML = '';
        tableBody.parentElement.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    tableBody.parentElement.style.display = 'table';
    emptyState.style.display = 'none';
    
    const userRole = localStorage.getItem('user_role');
    
    tableBody.innerHTML = currentHolidays.map(holiday => `
        <tr class="holiday-row">
            <td>
                <div class="holiday-date">
                    <i class="fa-regular fa-calendar" style="color: #64748b; margin-right: 0.5rem;"></i>
                    ${new Date(holiday.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </div>
            </td>
            <td>
                <div style="font-weight: 600; color: #0f172a;">${escapeHtml(holiday.name)}</div>
            </td>
            <td>
                <span class="badge-${holiday.type.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(holiday.type)}</span>
            </td>
            <td>
                <div style="color: #64748b; font-size: 0.9rem;">${escapeHtml(holiday.description || 'No description')}</div>
            </td>
            ${userRole === 'admin' ? `
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" onclick="openEditModal(${holiday.id})" title="Edit Holiday">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteHoliday(${holiday.id})" title="Delete Holiday">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>` : ''}
        </tr>
    `).join('');
}

function openAddModal() {
    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-plus" style="color: #2563eb;"></i> Add Holiday';
    document.getElementById('holidayForm').reset();
    document.getElementById('holidayId').value = '';
    document.getElementById('holidayModal').classList.add('active');
}

function openEditModal(id) {
    const holiday = currentHolidays.find(h => h.id === id);
    if (!holiday) return;

    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-pen" style="color: #2563eb;"></i> Edit Holiday';
    document.getElementById('holidayId').value = holiday.id;
    document.getElementById('holidayDate').value = holiday.date;
    document.getElementById('holidayName').value = holiday.name;
    document.getElementById('holidayType').value = holiday.type;
    document.getElementById('holidayDescription').value = holiday.description || '';
    
    document.getElementById('holidayModal').classList.add('active');
}

function closeHolidayModal() {
    document.getElementById('holidayModal').classList.remove('active');
}

async function saveHoliday() {
    const id = document.getElementById('holidayId').value;
    const date = document.getElementById('holidayDate').value;
    const name = document.getElementById('holidayName').value;
    const type = document.getElementById('holidayType').value;
    const description = document.getElementById('holidayDescription').value;
    const admin_id = localStorage.getItem('user_id');

    if (!date || !name || !type) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const payload = { date, name, type, description, admin_id };
    const method = id ? 'PUT' : 'POST';
    const url = id 
        ? `${window.API_BASE_URL}/api/admin/holidays/${id}`
        : `${window.API_BASE_URL}/api/admin/holidays`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save holiday');
        }

        showToast(`Holiday successfully ${id ? 'updated' : 'added'}!`, 'success');
        closeHolidayModal();
        loadHolidays();
    } catch (error) {
        console.error('Error saving holiday:', error);
        showToast(error.message, 'error');
    }
}

async function deleteHoliday(id) {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    const admin_id = localStorage.getItem('user_id');
    
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/admin/holidays/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ admin_id })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete holiday');
        }

        showToast('Holiday deleted successfully', 'success');
        loadHolidays();
    } catch (error) {
        console.error('Error deleting holiday:', error);
        showToast(error.message, 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    toast.innerHTML = `
        <i class="fa-solid fa-${icon} toast-icon"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

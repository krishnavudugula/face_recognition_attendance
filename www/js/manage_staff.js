
document.addEventListener('DOMContentLoaded', () => {
    fetchUsers();
    
    // Add search functionality
    const searchInput = document.getElementById('searchStaff');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#staffTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(query)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
});

async function fetchUsers() {
    const tableBody = document.getElementById('staffTableBody');
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        const response = await fetch('/api/users');
        const users = await response.json();

        tableBody.innerHTML = '';

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No staff found.</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="width: 40px; height: 40px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <span style="font-weight: bold; color: #64748b;">${user.name.charAt(0).toUpperCase()}</span>
                    </div>
                </td>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.role}</td>
                <td><span class="status-pill ${getStatusClass(user.status)}">${user.status}</span></td>
                <td>
                    ${getActionButtons(user)}
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error fetching users:", error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: red;">Failed to load data.</td></tr>';
    }
}

function getStatusClass(status) {
    if (status === 'Present' || status === 'On-Time') return 'status-present';
    if (status === "Didn't Mark" || status === 'Absent') return 'status-absent';
    if (status === 'Late' || status === 'Late Permission') return 'status-late';
    return '';
}

function getActionButtons(user) {
    if (user.role === 'admin') return ''; // Keep admins read-only in this directory
    
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminId = currentUser.user_id || currentUser.id || 'ADMIN01';
    
    return `
        <button class="icon-btn" onclick="viewUserLogs('${user.id}')" title="View Profile" style="color: #3b82f6;">
            <i class="fa-solid fa-eye"></i>
        </button>
        <button class="icon-btn danger-btn" onclick="markUserAbsent('${user.id}', '${user.name}', '${adminId}')" title="Mark as Didn't Mark">
            <i class="fa-solid fa-user-slash"></i>
        </button>
        <button class="icon-btn danger-btn" onclick="deleteUser('${user.id}')" title="Delete Staff Member">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
}

function viewUserLogs(userId) {
    // Redirect to faculty dashboard view for this user
    // We pass a parameter so the dashboard load logic knows to fetch THIS user's data
    window.location.href = `/pages/faculty_dashboard.html?view_user=${userId}`;
}

async function markUserAbsent(userId, userName, adminId) {
    if (!confirm(`Mark ${userName} as "Didn't Mark" for today?`)) {
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
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
            alert(`✓ ${userName} marked as "Didn't Mark" for today`);
            fetchUsers(); // Refresh table
        } else {
            alert("Error marking user: " + result.message);
        }
    } catch (error) {
        console.error("Mark absent failed:", error);
        alert("Server error. Please try again.");
    }
}

async function deleteUser(userId) {
    if(!confirm(`Are you sure you want to PERMANENTLY delete user ${userId}? This will remove all their attendance history.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert("User deleted successfully.");
            fetchUsers(); // Refresh table
        } else {
            alert("Error deleting user: " + result.message);
        }
    } catch (error) {
        console.error("Delete failed:", error);
        alert("Server error during deletion.");
    }
}

// Admin Portal JavaScript

// API_BASE_URL is declared in profile.js (shared across all pages)

// Initialize admin page
document.addEventListener('DOMContentLoaded', function() {
  initializeAdminPage();
});

/**
 * Initialize the admin page
 */
function initializeAdminPage() {
  // Update navbar auth state (ensures profile icon/logout are shown)
  if (typeof updateNavbarAuthState === 'function') {
    updateNavbarAuthState();
  }
  
  // Check if admin is signed in
  checkAdminAuth();
  
  // Load admin data for active tab
  loadAdminData();
}

/**
 * Check if admin is signed in
 */
function checkAdminAuth() {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userRole = localStorage.getItem('userRole');
  
  if (!isAuthenticated || userRole !== 'Admin') {
    // Redirect to home if not authenticated as admin
    window.location.href = './index.html';
  }
  
  // Show admin portal nav link
  const adminPortalNavItem = document.getElementById('adminPortalNavItem');
  if (adminPortalNavItem) {
    adminPortalNavItem.style.display = 'block';
  }
}

/**
 * Load admin data for active tab
 */
async function loadAdminData() {
  try {
    // Load data for active tab only
    const roomAssignmentTab = document.getElementById('roomAssignmentTab');
    if (roomAssignmentTab && roomAssignmentTab.classList.contains('active')) {
      await loadUnassignedSessions();
    }
    
    const allSessionsTab = document.getElementById('allSessionsTab');
    if (allSessionsTab && allSessionsTab.classList.contains('active')) {
      await loadAllSessions();
    }
  } catch (error) {
    console.error('Error loading admin data:', error);
  }
}

/**
 * Load and display unassigned sessions
 */
async function loadUnassignedSessions() {
  const unassignedSessionsDataContainer = document.getElementById('unassignedSessionsData');
  
  if (!unassignedSessionsDataContainer) return;
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    unassignedSessionsDataContainer.innerHTML = '<p class="text-danger">Please log in to view sessions.</p>';
    return;
  }

  try {
    // Fetch unassigned sessions data
    const response = await fetch(`${API_BASE_URL}/admin/unassigned-sessions?email=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch unassigned sessions data');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load unassigned sessions');
    }
    
    const sessionsList = data.data || [];
    
    // Render sessions table
    if (sessionsList.length === 0) {
      unassignedSessionsDataContainer.innerHTML = `
        <div class="alert alert-info">
          <p class="mb-0">No unassigned sessions found. All sessions have been assigned rooms.</p>
        </div>
      `;
      return;
    }
    
    unassignedSessionsDataContainer.innerHTML = `
      <div class="table-responsive">
        <table class="table table-dark table-striped table-hover">
          <thead>
            <tr>
              <th>Session Date</th>
              <th>Start Time</th>
              <th>Trainer Name</th>
              <th>Client Name</th>
              <th>Specialty</th>
              <th>Price</th>
              <th>Status</th>
              <th>Available Rooms</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="unassignedSessionsTableBody">
          </tbody>
        </table>
      </div>
    `;
    
    const tbody = document.getElementById('unassignedSessionsTableBody');
    
    // Load rooms for each session and render rows
    for (const session of sessionsList) {
      const availableRooms = await loadAvailableRooms(session.sessionId, session.sessionDate, session.startTime, session.specialtyId);
      const row = createUnassignedSessionRow(session, availableRooms);
      tbody.innerHTML += row;
    }
    
  } catch (error) {
    console.error('Error loading unassigned sessions data:', error);
    unassignedSessionsDataContainer.innerHTML = '<p class="text-danger">Error loading unassigned sessions data. Please try again later.</p>';
  }
}

/**
 * Create a table row for an unassigned session
 */
function createUnassignedSessionRow(session, availableRooms) {
  const formattedDate = formatDate(session.sessionDate);
  const formattedTime = formatTime(session.startTime);
  const formattedPrice = formatCurrency(session.price);
  const statusBadge = getStatusBadge(session.status);
  
  let roomSelectHTML = '<select class="form-select form-select-sm" id="roomSelect_' + session.sessionId + '">';
  roomSelectHTML += '<option value="">Select a room</option>';
  
  if (availableRooms && availableRooms.length > 0) {
    availableRooms.forEach(room => {
      roomSelectHTML += `<option value="${room.roomId}">${room.roomName} (${room.roomNo})</option>`;
    });
  } else {
    roomSelectHTML += '<option value="" disabled>No available rooms</option>';
  }
  
  roomSelectHTML += '</select>';
  
  const assignButton = availableRooms && availableRooms.length > 0
    ? `<button class="btn btn-sm btn-primary" onclick="assignRoomToSession(${session.sessionId})">Assign Room</button>`
    : '<button class="btn btn-sm btn-secondary" disabled>No Rooms Available</button>';
  
  return `
    <tr>
      <td>${formattedDate}</td>
      <td>${formattedTime}</td>
      <td>${session.trainerName}</td>
      <td>${session.clientName}</td>
      <td>${session.specialtyName}</td>
      <td>${formattedPrice}</td>
      <td>${statusBadge}</td>
      <td>${roomSelectHTML}</td>
      <td>${assignButton}</td>
    </tr>
  `;
}

/**
 * Load available rooms for a session
 */
async function loadAvailableRooms(sessionId, sessionDate, startTime, specialtyId) {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) return [];
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/available-rooms?email=${encodeURIComponent(userEmail)}&sessionDate=${sessionDate}&startTime=${startTime}&specialtyId=${specialtyId}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch available rooms');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load available rooms');
    }
    
    return data.data || [];
  } catch (error) {
    console.error('Error loading available rooms:', error);
    return [];
  }
}

/**
 * Assign room to session
 */
async function assignRoomToSession(sessionId) {
  const roomSelect = document.getElementById('roomSelect_' + sessionId);
  if (!roomSelect || !roomSelect.value) {
    alert('Please select a room first.');
    return;
  }
  
  const roomId = parseInt(roomSelect.value);
  if (!roomId) {
    alert('Invalid room selection.');
    return;
  }
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    alert('Please log in to assign rooms.');
    return;
  }
  
  if (!confirm('Are you sure you want to assign this room to the session?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/assign-room?email=${encodeURIComponent(userEmail)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionId,
        roomId: roomId
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to assign room');
    }
    
    if (data.success) {
      alert('Room assigned successfully!');
      // Reload unassigned sessions
      await loadUnassignedSessions();
    } else {
      alert(data.message || 'Failed to assign room. Please try again.');
    }
  } catch (error) {
    console.error('Error assigning room:', error);
    alert('An error occurred while assigning the room. Please try again.');
  }
}

/**
 * Load and display all sessions
 */
async function loadAllSessions() {
  const allSessionsDataContainer = document.getElementById('allSessionsData');
  
  if (!allSessionsDataContainer) return;
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    allSessionsDataContainer.innerHTML = '<p class="text-danger">Please log in to view sessions.</p>';
    return;
  }

  try {
    // Fetch all sessions data
    const response = await fetch(`${API_BASE_URL}/admin/all-sessions?email=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch all sessions data');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load all sessions');
    }
    
    const sessionsList = data.data || [];
    
    // Render sessions table
    if (sessionsList.length === 0) {
      allSessionsDataContainer.innerHTML = `
        <div class="alert alert-info">
          <p class="mb-0">No sessions found.</p>
        </div>
      `;
      return;
    }
    
    allSessionsDataContainer.innerHTML = `
      <div class="table-responsive">
        <table class="table table-dark table-striped table-hover">
          <thead>
            <tr>
              <th>Session Date</th>
              <th>Start Time</th>
              <th>Trainer Name</th>
              <th>Client Name</th>
              <th>Specialty</th>
              <th>Room</th>
              <th>Price</th>
              <th>Status</th>
              <th>Payment Status</th>
              <th>Booking Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="allSessionsTableBody">
          </tbody>
        </table>
      </div>
    `;
    
    const tbody = document.getElementById('allSessionsTableBody');
    tbody.innerHTML = sessionsList.map(session => {
      const statusBadge = getStatusBadge(session.status);
      const paymentBadge = getPaymentStatusBadge(session.paymentStatus);
      const formattedDate = formatDate(session.sessionDate);
      const formattedTime = formatTime(session.startTime);
      const formattedPrice = formatCurrency(session.price);
      const formattedBookingDate = session.bookingDate ? formatDateTime(session.bookingDate) : 'N/A';
      
      // Unassign button - only show if room is assigned
      const unassignButton = session.roomId
        ? `<button class="btn btn-sm btn-warning" onclick="unassignRoom(${session.sessionId})">Unassign Room</button>`
        : '<span class="text-muted">-</span>';
      
      return `
        <tr>
          <td>${formattedDate}</td>
          <td>${formattedTime}</td>
          <td>${session.trainerName}</td>
          <td>${session.clientName}</td>
          <td>${session.specialtyName}</td>
          <td>${session.roomName || 'Not assigned'}</td>
          <td>${formattedPrice}</td>
          <td>${statusBadge}</td>
          <td>${paymentBadge}</td>
          <td>${formattedBookingDate}</td>
          <td>${unassignButton}</td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading all sessions data:', error);
    allSessionsDataContainer.innerHTML = '<p class="text-danger">Error loading all sessions data. Please try again later.</p>';
  }
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
  const badges = {
    'Pending': '<span class="badge bg-warning text-dark">Pending</span>',
    'Confirmed': '<span class="badge bg-info">Confirmed</span>',
    'Completed': '<span class="badge bg-success">Completed</span>',
    'Cancelled': '<span class="badge bg-danger">Cancelled</span>'
  };
  return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
}

/**
 * Get payment status badge HTML
 */
function getPaymentStatusBadge(status) {
  const badges = {
    'Pending': '<span class="badge bg-warning text-dark">Pending</span>',
    'Completed': '<span class="badge bg-success">Completed</span>',
    'Failed': '<span class="badge bg-danger">Failed</span>'
  };
  return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
}

/**
 * Format date from YYYY-MM-DD to MM/DD/YYYY
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString + 'T00:00:00');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format time from HH:MM to 12-hour format
 */
function formatTime(time24) {
  if (!time24) return 'N/A';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Format date-time string
 */
function formatDateTime(dateTimeString) {
  if (!dateTimeString) return 'N/A';
  const date = new Date(dateTimeString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${month}/${day}/${year} ${hour12}:${minutes} ${ampm}`;
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '$0.00';
  return `$${parseFloat(amount).toFixed(2)}`;
}

/**
 * Unassign room from a session
 */
async function unassignRoom(sessionId) {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    alert('Please log in to unassign rooms.');
    return;
  }
  
  if (!confirm('Are you sure you want to unassign the room from this session? The session will appear in the Room Assignment tab for reassignment.')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/unassign-room?email=${encodeURIComponent(userEmail)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionId
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to unassign room');
    }
    
    if (data.success) {
      alert('Room unassigned successfully! The session is now available for room assignment.');
      // Reload all sessions
      await loadAllSessions();
      // If on Room Assignment tab, reload that too
      const roomAssignmentTab = document.getElementById('roomAssignmentTab');
      if (roomAssignmentTab && roomAssignmentTab.classList.contains('active')) {
        await loadUnassignedSessions();
      }
    } else {
      alert(data.message || 'Failed to unassign room. Please try again.');
    }
  } catch (error) {
    console.error('Error unassigning room:', error);
    alert('An error occurred while unassigning the room. Please try again.');
  }
}

// Make functions globally available
window.loadUnassignedSessions = loadUnassignedSessions;
window.loadAllSessions = loadAllSessions;
window.assignRoomToSession = assignRoomToSession;
window.unassignRoom = unassignRoom;


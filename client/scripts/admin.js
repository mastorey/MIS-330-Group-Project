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
  
  // Initialize reports
  initializeReports();
  
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
    // Build HTML string first to avoid O(n²) complexity from innerHTML +=
    let rowsHtml = '';
    for (const session of sessionsList) {
      const availableRooms = await loadAvailableRooms(session.sessionId, session.sessionDate, session.startTime, session.specialtyId);
      const row = createUnassignedSessionRow(session, availableRooms);
      rowsHtml += row;
    }
    // Set innerHTML once after building all rows
    tbody.innerHTML = rowsHtml;
    
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
  if (!dateString || dateString === 'null' || dateString === null || dateString === undefined) return 'N/A';
  
  // Handle MySQL DATE format (YYYY-MM-DD)
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
  }
  
  // Try to parse as Date object
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch (e) {
    return 'N/A';
  }
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

// ============================================================================
// Reports Dashboard Functions
// ============================================================================

let currentReportId = 'specialty-performance';
let currentChart = null;

/**
 * Initialize reports tab
 */
function initializeReports() {
  // Set default report selector
  const reportSelector = document.getElementById('reportSelector');
  if (reportSelector) {
    reportSelector.value = currentReportId;
  }
  
  const reportsTab = document.getElementById('reportsTab');
  if (reportsTab) {
    // Load default report when tab is shown
    const reportsTabButton = document.getElementById('reports-tab');
    if (reportsTabButton) {
      reportsTabButton.addEventListener('shown.bs.tab', function() {
        loadReport(currentReportId);
      });
    }
  }
}

/**
 * Load a specific report
 */
async function loadReport(reportId) {
  currentReportId = reportId;
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    showReportError('Please log in to view reports.');
    return;
  }

  // Show loading, hide error and display
  document.getElementById('reportLoading').style.display = 'block';
  document.getElementById('reportError').style.display = 'none';
  document.getElementById('reportDisplay').style.display = 'none';

  try {
    const response = await fetch(`${API_BASE_URL}/admin/reports/${reportId}?email=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch report data');
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to load report');
    }
    
    // Hide loading, show display
    document.getElementById('reportLoading').style.display = 'none';
    document.getElementById('reportDisplay').style.display = 'block';
    
    // Render report
    renderReport(reportId, result.data, result.reportName);
    
  } catch (error) {
    console.error('Error loading report:', error);
    showReportError('Error loading report data. Please try again later.');
    document.getElementById('reportLoading').style.display = 'none';
  }
}

/**
 * Show report error message
 */
function showReportError(message) {
  document.getElementById('reportError').style.display = 'block';
  document.getElementById('reportErrorMessage').textContent = message;
  document.getElementById('reportLoading').style.display = 'none';
  document.getElementById('reportDisplay').style.display = 'none';
}

/**
 * Render report with chart and table
 */
function renderReport(reportId, data, reportName) {
  if (!data || data.length === 0) {
    showReportError('No data available for this report.');
    return;
  }

  // Set report title
  document.getElementById('reportTitle').textContent = reportName;

  // Destroy existing chart
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }

  // Render chart and table based on report type
  switch (reportId) {
    case 'specialty-performance':
      renderSpecialtyPerformanceReport(data);
      break;
    case 'trainer-performance':
      renderTrainerPerformanceReport(data);
      break;
    case 'revenue-trends':
      renderRevenueTrendsReport(data);
      break;
    case 'client-activity':
      renderClientActivityReport(data);
      break;
    case 'room-utilization':
      renderRoomUtilizationReport(data);
      break;
    case 'booking-status':
      renderBookingStatusReport(data);
      break;
    case 'payment-status':
      renderPaymentStatusReport(data);
      break;
    case 'trainer-utilization':
      renderTrainerUtilizationReport(data);
      break;
    case 'session-completion':
      renderSessionCompletionReport(data);
      break;
    default:
      showReportError('Unknown report type.');
  }
}

/**
 * Render Specialty Performance Report
 */
function renderSpecialtyPerformanceReport(data) {
  const labels = data.map(row => row.SpecialtyName);
  const revenues = data.map(row => parseFloat(row.TotalRevenue || 0));
  
  // Chart
  const ctx = document.getElementById('reportChart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Revenue ($)',
        data: revenues,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Revenue: $' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          }
        }
      }
    }
  });

  // Table
  const headers = ['Specialty Name', 'Has Bookings', 'Total Sessions', 'Total Revenue', 'Avg Session Price'];
  const rows = data.map(row => [
    row.SpecialtyName,
    row.HasBookings,
    row.TotalSessionsBooked,
    formatCurrency(row.TotalRevenue),
    formatCurrency(row.AverageSessionPrice)
  ]);
  renderTable(headers, rows);
}

/**
 * Render Trainer Performance Report
 */
function renderTrainerPerformanceReport(data) {
  const labels = data.map(row => row.TrainerName);
  const revenues = data.map(row => parseFloat(row.TotalRevenue || 0));
  
  const ctx = document.getElementById('reportChart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Revenue ($)',
        data: revenues,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Revenue: $' + context.parsed.x.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          }
        }
      }
    }
  });

  const headers = ['Trainer Name', 'Email', 'Rate/Hour', 'Sessions', 'Completed', 'Completion Rate', 'Revenue', 'Avg Price'];
  const rows = data.map(row => [
    row.TrainerName,
    row.TrainerEmail,
    formatCurrency(row.AverageRatePerHour),
    row.TotalSessionsBooked,
    row.CompletedSessions,
    (parseFloat(row.CompletionRate || 0)).toFixed(2) + '%',
    formatCurrency(row.TotalRevenue),
    formatCurrency(row.AverageSessionPrice)
  ]);
  renderTable(headers, rows);
}

/**
 * Render Revenue Trends Report
 */
function renderRevenueTrendsReport(data) {
  const labels = data.map(row => row.YearMonth);
  const revenues = data.map(row => parseFloat(row.TotalRevenue || 0));
  const sessions = data.map(row => parseInt(row.TotalSessions || 0));
  
  const ctx = document.getElementById('reportChart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Revenue ($)',
          data: revenues,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          yAxisID: 'y',
          tension: 0.4
        },
        {
          label: 'Sessions',
          data: sessions,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          yAxisID: 'y1',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 0) {
                return 'Revenue: $' + context.parsed.y.toFixed(2);
              } else {
                return 'Sessions: ' + context.parsed.y;
              }
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  const headers = ['Month', 'Total Sessions', 'Total Revenue', 'Avg Session Price'];
  const rows = data.map(row => [
    row.YearMonth,
    row.TotalSessions,
    formatCurrency(row.TotalRevenue),
    formatCurrency(row.AverageSessionPrice)
  ]);
  renderTable(headers, rows);
}

/**
 * Render Client Activity Report
 */
function renderClientActivityReport(data) {
  // Show top 10 clients
  const topClients = data.slice(0, 10);
  const labels = topClients.map(row => row.ClientName);
  const spending = topClients.map(row => parseFloat(row.TotalAmountSpent || 0));
  
  const ctx = document.getElementById('reportChart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Spent ($)',
        data: spending,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Spent: $' + context.parsed.x.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          }
        }
      }
    }
  });

  const headers = ['Client Name', 'Email', 'Join Date', 'Sessions', 'Total Spent', 'Avg Price', 'Last Booking'];
  const rows = data.map(row => [
    row.ClientName,
    row.ClientEmail,
    formatDate(row.JoinDate),
    row.TotalSessionsBooked,
    formatCurrency(row.TotalAmountSpent),
    formatCurrency(row.AverageSessionPrice),
    row.MostRecentBookingDate ? formatDateTime(row.MostRecentBookingDate) : 'N/A'
  ]);
  renderTable(headers, rows);
}

/**
 * Render Room Utilization Report
 */
function renderRoomUtilizationReport(data) {
  const labels = data.map(row => row.RoomName);
  const sessions = data.map(row => parseInt(row.TotalSessionsAssigned || 0));
  
  const ctx = document.getElementById('reportChart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sessions Assigned',
        data: sessions,
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });

  const headers = ['Room Name', 'Room No', 'Sessions', 'Hours', 'Revenue'];
  const rows = data.map(row => [
    row.RoomName,
    row.RoomNo,
    row.TotalSessionsAssigned,
    row.TotalHoursUtilized,
    formatCurrency(row.RevenueGenerated)
  ]);
  renderTable(headers, rows);
}

/**
 * Render Booking Status Report
 */
function renderBookingStatusReport(data) {
  const labels = data.map(row => row.Status);
  const counts = data.map(row => parseInt(row.SessionCount || 0));
  const colors = ['rgba(255, 206, 86, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'];
  
  const ctx = document.getElementById('reportChart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = counts.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return label + ': ' + value + ' (' + percentage + '%)';
            }
          }
        }
      }
    }
  });

  const headers = ['Status', 'Session Count', 'Total Revenue', '% of Sessions', '% of Revenue'];
  const rows = data.map(row => [
    row.Status,
    row.SessionCount,
    formatCurrency(row.TotalRevenue),
    (parseFloat(row.PercentageOfTotalSessions || 0)).toFixed(2) + '%',
    (parseFloat(row.PercentageOfTotalRevenue || 0)).toFixed(2) + '%'
  ]);
  renderTable(headers, rows);
}

/**
 * Render Payment Status Report
 */
function renderPaymentStatusReport(data) {
  const labels = data.map(row => row.PaymentStatus);
  const amounts = data.map(row => parseFloat(row.TotalAmount || 0));
  const colors = ['rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(153, 102, 255, 0.6)'];
  
  const ctx = document.getElementById('reportChart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: amounts,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': $' + context.parsed.toFixed(2);
            }
          }
        }
      }
    }
  });

  const headers = ['Payment Status', 'Payment Count', 'Total Amount', 'Avg Amount', '% of Payments', '% of Revenue'];
  const rows = data.map(row => [
    row.PaymentStatus,
    row.PaymentCount,
    formatCurrency(row.TotalAmount),
    formatCurrency(row.AveragePaymentAmount),
    (parseFloat(row.PercentageOfTotalPayments || 0)).toFixed(2) + '%',
    (parseFloat(row.PercentageOfTotalRevenue || 0)).toFixed(2) + '%'
  ]);
  renderTable(headers, rows);
}

/**
 * Render Trainer Utilization Report
 */
function renderTrainerUtilizationReport(data) {
  const labels = data.map(row => row.TrainerName);
  const rates = data.map(row => parseFloat(row.UtilizationRate || 0));
  
  const ctx = document.getElementById('reportChart').getContext('2d');
  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Utilization Rate (%)',
        data: rates,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Utilization: ' + context.parsed.x.toFixed(2) + '%';
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });

  const headers = ['Trainer Name', 'Availability Slots', 'Booked Sessions', 'Utilization Rate', 'Revenue'];
  const rows = data.map(row => [
    row.TrainerName,
    row.TotalAvailabilitySlots,
    row.TotalBookedSessions,
    (parseFloat(row.UtilizationRate || 0)).toFixed(2) + '%',
    formatCurrency(row.RevenueGenerated)
  ]);
  renderTable(headers, rows);
}

/**
 * Render Session Completion Report
 */
function renderSessionCompletionReport(data) {
  // Group by category
  const overall = data.find(row => row.Category === 'Overall');
  const bySpecialty = data.filter(row => row.Category === 'By Specialty');
  const byTrainer = data.filter(row => row.Category === 'By Trainer');

  // Chart for completion rates by specialty
  if (bySpecialty.length > 0) {
    const labels = bySpecialty.map(row => row.SubCategory);
    const completionRates = bySpecialty.map(row => parseFloat(row.CompletionRate || 0));
    
    const ctx = document.getElementById('reportChart').getContext('2d');
    currentChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Completion Rate (%)',
          data: completionRates,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Completion Rate: ' + context.parsed.x.toFixed(2) + '%';
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
  }

  const headers = ['Category', 'Sub Category', 'Total Sessions', 'Completed', 'Cancelled', 'Completion Rate', 'Cancellation Rate', 'Revenue Lost'];
  const rows = data.map(row => [
    row.Category,
    row.SubCategory,
    row.TotalSessions,
    row.CompletedSessions,
    row.CancelledSessions,
    (parseFloat(row.CompletionRate || 0)).toFixed(2) + '%',
    (parseFloat(row.CancellationRate || 0)).toFixed(2) + '%',
    formatCurrency(row.RevenueLostFromCancellations)
  ]);
  renderTable(headers, rows);
}

/**
 * Render data table
 */
function renderTable(headers, rows) {
  const thead = document.getElementById('reportTableHead');
  const tbody = document.getElementById('reportTableBody');
  
  // Clear existing content
  thead.innerHTML = '';
  tbody.innerHTML = '';
  
  // Create header row
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  
  // Create data rows
  rows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// Make functions globally available
window.loadUnassignedSessions = loadUnassignedSessions;
window.loadAllSessions = loadAllSessions;
window.assignRoomToSession = assignRoomToSession;
window.unassignRoom = unassignRoom;
window.loadReport = loadReport;
window.initializeReports = initializeReports;


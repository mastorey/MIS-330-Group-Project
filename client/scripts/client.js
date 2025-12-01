// Client Portal JavaScript

// API_BASE_URL is declared in profile.js (shared across all pages)

// Initialize client page
document.addEventListener('DOMContentLoaded', function() {
  initializeClientPage();
});

/**
 * Initialize the client page
 */
function initializeClientPage() {
  // Update navbar auth state (ensures profile icon/logout are shown)
  if (typeof updateNavbarAuthState === 'function') {
    updateNavbarAuthState();
  }
  
  // Check if client is signed in
  checkClientAuth();
  
  // Load client data for active tab
  loadClientData();
}

/**
 * Check if client is signed in
 */
function checkClientAuth() {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userRole = localStorage.getItem('userRole');
  
  if (!isAuthenticated || userRole !== 'Client') {
    // Redirect to home if not authenticated as client
    window.location.href = './index.html';
  }
}

/**
 * Load client data for active tab
 */
async function loadClientData() {
  try {
    // Load data for active tab only
    const mySessionsTab = document.getElementById('mySessionsTab');
    if (mySessionsTab && mySessionsTab.classList.contains('active')) {
      await loadMySessions();
    }
    
    const findSessionsTab = document.getElementById('findSessionsTab');
    if (findSessionsTab && findSessionsTab.classList.contains('active')) {
      await loadFindSessions();
    }
  } catch (error) {
    console.error('Error loading client data:', error);
  }
}

/**
 * Load and display client's booked sessions
 */
async function loadMySessions() {
  const sessionsDataContainer = document.getElementById('mySessionsData');
  
  if (!sessionsDataContainer) return;
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    sessionsDataContainer.innerHTML = '<p class="text-danger">Please log in to view sessions.</p>';
    return;
  }

  try {
    // Fetch sessions data
    const response = await fetch(`${API_BASE_URL}/client/sessions?email=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch sessions data');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load sessions');
    }
    
    const sessionsList = data.data || [];
    
    // Render sessions table
    if (sessionsList.length === 0) {
      sessionsDataContainer.innerHTML = `
        <div class="alert alert-info">
          <p class="mb-0">No booked sessions found.</p>
        </div>
      `;
      return;
    }
    
    sessionsDataContainer.innerHTML = `
      <div class="table-responsive">
        <table class="table table-dark table-striped table-hover">
          <thead>
            <tr>
              <th>Session Date</th>
              <th>Start Time</th>
              <th>Trainer Name</th>
              <th>Specialty</th>
              <th>Room</th>
              <th>Price</th>
              <th>Status</th>
              <th>Payment Status</th>
              <th>Booking Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="mySessionsTableBody">
          </tbody>
        </table>
      </div>
    `;
    
    const tbody = document.getElementById('mySessionsTableBody');
    tbody.innerHTML = sessionsList.map(session => {
      const statusBadge = getStatusBadge(session.status);
      const paymentBadge = getPaymentStatusBadge(session.paymentStatus);
      const formattedDate = formatDate(session.sessionDate);
      const formattedTime = formatTime(session.startTime);
      const formattedPrice = formatCurrency(session.price);
      const formattedBookingDate = session.bookingDate ? formatDateTime(session.bookingDate) : 'N/A';
      
      // Show Pay button if payment status is not Completed
      const payButton = session.paymentStatus !== 'Completed' && session.status !== 'Cancelled'
        ? `<button class="btn btn-sm btn-primary me-1" onclick="handlePayment(${session.sessionId}, ${session.price})">Pay</button>`
        : '';
      
      // Show Cancel button if session is not Cancelled or Completed
      const cancelButton = session.status !== 'Cancelled' && session.status !== 'Completed'
        ? `<button class="btn btn-sm btn-danger" onclick="cancelSession(${session.sessionId})">Cancel</button>`
        : '<span class="text-muted">-</span>';
      
      return `
        <tr style="cursor: pointer;" onclick="showSessionDetails(${session.sessionId}, '${session.trainerName}', '${session.specialtyName}', '${formattedDate}', '${formattedTime}', '${session.roomName || 'Not assigned'}', '${formattedPrice}', '${session.status}', '${session.paymentStatus}')" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.1)'" onmouseout="this.style.backgroundColor=''">
          <td>${formattedDate}</td>
          <td>${formattedTime}</td>
          <td>${session.trainerName}</td>
          <td>${session.specialtyName}</td>
          <td>${session.roomName || 'Not assigned'}</td>
          <td>${formattedPrice}</td>
          <td>${statusBadge}</td>
          <td>${paymentBadge}</td>
          <td>${formattedBookingDate}</td>
          <td onclick="event.stopPropagation();">
            <div class="d-flex gap-1">
              ${payButton}
              ${cancelButton}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading sessions data:', error);
    sessionsDataContainer.innerHTML = '<p class="text-danger">Error loading sessions data. Please try again later.</p>';
  }
}

/**
 * Load find sessions
 */
async function loadFindSessions() {
  const findSessionsDataContainer = document.getElementById('findSessionsData');
  
  if (!findSessionsDataContainer) return;
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    findSessionsDataContainer.innerHTML = '<p class="text-danger">Please log in to view available sessions.</p>';
    return;
  }

  try {
    // Fetch available sessions
    const response = await fetch(`${API_BASE_URL}/client/available-sessions?email=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch available sessions');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load available sessions');
    }
    
    const sessionsList = data.data || [];
    
    // Render sorting controls and sessions
    findSessionsDataContainer.innerHTML = `
      <div class="mb-4">
        <div class="row g-3">
          <div class="col-md-2">
            <label for="sortSpecialty" class="form-label">Sort by Specialty</label>
            <select class="form-select" id="sortSpecialty" onchange="applySorting()">
              <option value="">All Specialties</option>
            </select>
          </div>
          <div class="col-md-2">
            <label for="sortTime" class="form-label">Sort by Time</label>
            <select class="form-select" id="sortTime" onchange="applySorting()">
              <option value="">All Times</option>
              <option value="morning">Morning (6 AM - 12 PM)</option>
              <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
              <option value="evening">Evening (5 PM - 9 PM)</option>
            </select>
          </div>
          <div class="col-md-2">
            <label for="sortDay" class="form-label">Sort by Day</label>
            <select class="form-select" id="sortDay" onchange="applySorting()">
              <option value="">All Days</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
          <div class="col-md-2">
            <label for="sortTrainer" class="form-label">Sort by Trainer</label>
            <select class="form-select" id="sortTrainer" onchange="applySorting()">
              <option value="">All Trainers</option>
            </select>
          </div>
          <div class="col-md-2">
            <label for="minPrice" class="form-label">Min Price ($)</label>
            <input type="number" class="form-control" id="minPrice" step="0.01" min="0" placeholder="0.00" onchange="applySorting()" />
          </div>
          <div class="col-md-2">
            <label for="maxPrice" class="form-label">Max Price ($)</label>
            <input type="number" class="form-control" id="maxPrice" step="0.01" min="0" placeholder="No limit" onchange="applySorting()" />
          </div>
        </div>
      </div>
      <div id="sessionsCardsContainer" class="row g-4">
      </div>
    `;
    
    // Store sessions globally for filtering
    window.availableSessions = sessionsList;
    
    // Populate specialty and trainer dropdowns
    const specialties = [...new Set(sessionsList.map(s => s.specialtyName))].sort();
    const trainers = [...new Set(sessionsList.map(s => s.trainerName))].sort();
    
    const sortSpecialty = document.getElementById('sortSpecialty');
    const sortTrainer = document.getElementById('sortTrainer');
    
    specialties.forEach(specialty => {
      const option = document.createElement('option');
      option.value = specialty;
      option.textContent = specialty;
      sortSpecialty.appendChild(option);
    });
    
    trainers.forEach(trainer => {
      const option = document.createElement('option');
      option.value = trainer;
      option.textContent = trainer;
      sortTrainer.appendChild(option);
    });
    
    // Render sessions
    renderSessionsCards(sessionsList);
    
  } catch (error) {
    console.error('Error loading available sessions:', error);
    findSessionsDataContainer.innerHTML = '<p class="text-danger">Error loading available sessions. Please try again later.</p>';
  }
}

/**
 * Render sessions as cards
 */
function renderSessionsCards(sessions) {
  const container = document.getElementById('sessionsCardsContainer');
  if (!container) return;
  
  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">
          <p class="mb-0">No available sessions found.</p>
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = sessions.map(session => {
    const formattedDate = formatDate(session.calculatedDate);
    const formattedTime = formatTime(session.startTime);
    const sessionRate = session.rate !== undefined && session.rate !== null ? parseFloat(session.rate) : 90.00;
    const formattedRate = formatCurrency(sessionRate);
    
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <h5 class="card-title">${session.trainerName}</h5>
            <p class="card-text">
              <strong>Specialty:</strong> ${session.specialtyName}<br>
              <strong>Day:</strong> ${session.dayOfWeek}<br>
              <strong>Time:</strong> ${formattedTime}<br>
              <strong>Date:</strong> ${formattedDate}<br>
              <strong class="text-primary">Price:</strong> ${formattedRate}
            </p>
            <button class="btn btn-primary w-100" onclick="bookSession(${session.availabilityId}, '${session.calculatedDate}', '${session.trainerName}', '${session.specialtyName}', '${session.dayOfWeek}', '${formattedTime}', '${formattedDate}')">
              Book Session
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Apply sorting/filtering
 */
function applySorting() {
  if (!window.availableSessions) return;
  
  const specialtyFilter = document.getElementById('sortSpecialty')?.value || '';
  const timeFilter = document.getElementById('sortTime')?.value || '';
  const dayFilter = document.getElementById('sortDay')?.value || '';
  const trainerFilter = document.getElementById('sortTrainer')?.value || '';
  const minPriceInput = document.getElementById('minPrice');
  const maxPriceInput = document.getElementById('maxPrice');
  const minPrice = minPriceInput?.value ? parseFloat(minPriceInput.value) : null;
  const maxPrice = maxPriceInput?.value ? parseFloat(maxPriceInput.value) : null;
  
  let filtered = [...window.availableSessions];
  
  // Filter by specialty
  if (specialtyFilter) {
    filtered = filtered.filter(s => s.specialtyName === specialtyFilter);
  }
  
  // Filter by day
  if (dayFilter) {
    filtered = filtered.filter(s => s.dayOfWeek === dayFilter);
  }
  
  // Filter by trainer
  if (trainerFilter) {
    filtered = filtered.filter(s => s.trainerName === trainerFilter);
  }
  
  // Filter by time range
  if (timeFilter) {
    filtered = filtered.filter(s => {
      const [hours] = s.startTime.split(':');
      const hour = parseInt(hours);
      
      if (timeFilter === 'morning') return hour >= 6 && hour < 12;
      if (timeFilter === 'afternoon') return hour >= 12 && hour < 17;
      if (timeFilter === 'evening') return hour >= 17 && hour < 21;
      return true;
    });
  }
  
  // Filter by price range
  if (minPrice !== null || maxPrice !== null) {
    filtered = filtered.filter(s => {
      const sessionRate = s.rate !== undefined && s.rate !== null ? parseFloat(s.rate) : 90.00;
      if (minPrice !== null && sessionRate < minPrice) return false;
      if (maxPrice !== null && sessionRate > maxPrice) return false;
      return true;
    });
  }
  
  // Sort by day and time
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  filtered.sort((a, b) => {
    const dayDiff = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });
  
  renderSessionsCards(filtered);
}

/**
 * Handle payment button click
 */
function handlePayment(sessionId, amount) {
  const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
  const paymentAmount = document.getElementById('paymentAmount');
  const paymentForm = document.getElementById('paymentForm');
  
  // Store session ID and amount
  paymentForm.dataset.sessionId = sessionId;
  paymentAmount.value = formatCurrency(amount);
  
  // Populate expiry years (current year to 10 years ahead)
  const expiryYear = document.getElementById('expiryYear');
  expiryYear.innerHTML = '<option value="">Year</option>';
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const option = document.createElement('option');
    option.value = (currentYear + i).toString();
    option.textContent = (currentYear + i).toString();
    expiryYear.appendChild(option);
  }
  
  // Reset form
  paymentForm.reset();
  paymentForm.classList.remove('was-validated');
  paymentAmount.value = formatCurrency(amount);
  
  paymentModal.show();
}

/**
 * Process payment
 */
async function processPayment(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const form = event.target;
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }
  
  const sessionId = parseInt(form.dataset.sessionId);
  const amount = parseFloat(document.getElementById('paymentAmount').value.replace('$', ''));
  const cardNumber = document.getElementById('cardNumber').value;
  const cardHolderName = document.getElementById('cardHolderName').value;
  const expiryMonth = document.getElementById('expiryMonth').value;
  const expiryYear = document.getElementById('expiryYear').value;
  const cvv = document.getElementById('cvv').value;
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    alert('Please log in to process payment.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/client/payment?email=${encodeURIComponent(userEmail)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionId,
        amount: amount,
        cardNumber: cardNumber,
        cardHolderName: cardHolderName,
        expiryMonth: parseInt(expiryMonth),
        expiryYear: parseInt(expiryYear),
        cvv: cvv
      }),
    });
    
    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim()) {
        data = JSON.parse(text);
      } else {
        throw new Error(`Server returned empty response (Status: ${response.status})`);
      }
    } else {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response (Status: ${response.status}): ${text.substring(0, 100)}`);
    }
    
    if (!response.ok) {
      throw new Error(data.message || `Server error: ${response.status} ${response.statusText}`);
    }
    
    if (data.success) {
      // Close modal
      const paymentModal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
      paymentModal.hide();
      
      // Reload sessions
      await loadMySessions();
      
      alert('Payment processed successfully!');
    } else {
      alert(data.message || 'Failed to process payment. Please try again.');
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    if (error.message.includes('404')) {
      alert('Payment endpoint not found. Please check if the API server is running.');
    } else if (error.message.includes('Unexpected end of JSON')) {
      alert('Server returned an invalid response. Please check if the API server is running correctly.');
    } else {
      alert(error.message || 'An error occurred while processing payment. Please try again.');
    }
  }
}

/**
 * Book a session
 */
function bookSession(availabilityId, calculatedDate, trainerName, specialtyName, dayOfWeek, formattedTime, formattedDate) {
  const bookingModal = new bootstrap.Modal(document.getElementById('bookingModal'));
  const bookingConfirmText = document.getElementById('bookingConfirmText');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  
  bookingConfirmText.textContent = `Are you sure you want to book a session with ${trainerName} for ${specialtyName} on ${dayOfWeek}, ${formattedDate} at ${formattedTime}?`;
  
  // Remove previous event listeners
  const newConfirmBtn = confirmBookingBtn.cloneNode(true);
  confirmBookingBtn.parentNode.replaceChild(newConfirmBtn, confirmBookingBtn);
  
  // Add new event listener
  newConfirmBtn.addEventListener('click', async () => {
    await confirmBooking(availabilityId, calculatedDate, bookingModal);
  });
  
  bookingModal.show();
}

/**
 * Confirm booking
 */
async function confirmBooking(availabilityId, calculatedDate, modal) {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    alert('Please log in to book a session.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/client/book-session?email=${encodeURIComponent(userEmail)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        availabilityId: availabilityId,
        calculatedDate: calculatedDate
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Close modal
      modal.hide();
      
      // Reload find sessions
      await loadFindSessions();
      
      // Switch to My Sessions tab
      const mySessionsTab = document.getElementById('mySessions-tab');
      if (mySessionsTab) {
        mySessionsTab.click();
        await loadMySessions();
      }
      
      alert('Session booked successfully!');
    } else {
      alert(data.message || 'Failed to book session. Please try again.');
    }
  } catch (error) {
    console.error('Error booking session:', error);
    alert('An error occurred while booking the session. Please try again.');
  }
}

/**
 * Cancel a booked session
 */
async function cancelSession(sessionId) {
  // Show confirmation popup
  if (!confirm('Are you sure you want to cancel this session? This action cannot be undone.')) {
    return;
  }

  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    alert('Please log in to cancel sessions.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/client/sessions/${sessionId}/cancel?email=${encodeURIComponent(userEmail)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Handle response - check if it's OK and has content
    let data;
    
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `Error ${response.status}: ${response.statusText || 'Unknown error'}`;
      try {
        const errorText = await response.text();
        if (errorText) {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
        }
      } catch {
        // If we can't read the response, use status text
      }
      
      alert(errorMessage);
      return;
    }
    
    // Response is OK, try to parse JSON
    try {
      const responseText = await response.text();
      if (responseText) {
        data = JSON.parse(responseText);
      } else {
        // Empty response but status is OK - assume success
        data = { success: true, message: 'Session cancelled successfully' };
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      // If parsing fails but status is OK, assume success
      data = { success: true, message: 'Session cancelled successfully' };
    }
    
    if (data.success) {
      // Reload sessions
      await loadMySessions();
      
      // Show success message
      if (typeof showSuccessModal === 'function') {
        showSuccessModal('Session cancelled successfully!');
      } else {
        alert('Session cancelled successfully!');
      }
    } else {
      alert(data.message || 'Failed to cancel session. Please try again.');
    }
  } catch (error) {
    console.error('Error cancelling session:', error);
    alert('An error occurred while cancelling the session. Please try again.');
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
 * Show session details in a modal
 */
function showSessionDetails(sessionId, trainerName, specialtyName, date, time, room, price, status, paymentStatus) {
  // Set modal content
  document.getElementById('detailDate').textContent = date;
  document.getElementById('detailTime').textContent = time;
  document.getElementById('detailTrainer').textContent = trainerName;
  document.getElementById('detailSpecialty').textContent = specialtyName;
  document.getElementById('detailRoom').textContent = room;
  document.getElementById('detailPrice').textContent = price;
  
  // Set status badge
  const statusColors = {
    'Pending': 'warning',
    'Confirmed': 'info',
    'Completed': 'success',
    'Cancelled': 'danger'
  };
  const statusColor = statusColors[status] || 'secondary';
  document.getElementById('detailStatus').innerHTML = `<span class="badge bg-${statusColor}">${status}</span>`;
  
  // Set payment status badge
  const paymentColors = {
    'Pending': 'warning',
    'Completed': 'success',
    'Failed': 'danger'
  };
  const paymentColor = paymentColors[paymentStatus] || 'secondary';
  document.getElementById('detailPaymentStatus').innerHTML = `<span class="badge bg-${paymentColor}">${paymentStatus}</span>`;
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('sessionDetailsModal'));
  modal.show();
}

// Make functions globally available
window.loadMySessions = loadMySessions;
window.loadFindSessions = loadFindSessions;
window.handlePayment = handlePayment;
window.processPayment = processPayment;
window.bookSession = bookSession;
window.applySorting = applySorting;
window.cancelSession = cancelSession;
window.showSessionDetails = showSessionDetails;


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
  
  // Load tracker data
  loadTrackerData();
  
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
 * Load tracker data (session tracker and calories)
 */
async function loadTrackerData() {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    console.warn('No user email found, cannot load tracker data');
    return;
  }

  console.log('[Tracker] Starting to load tracker data for:', userEmail);

  try {
    // Add cache-busting parameter to ensure fresh data
    const timestamp = new Date().getTime();
    const url = `${API_BASE_URL}/client/tracker?email=${encodeURIComponent(userEmail)}&_t=${timestamp}`;
    console.log('[Tracker] Fetching from URL:', url);
    
    const response = await fetch(url);
    
    console.log('[Tracker] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `Failed to fetch tracker data: ${response.status} ${response.statusText}`;
      try {
        const responseText = await response.text();
        console.error('[Tracker] Error response text:', responseText);
        // Try to parse as JSON
        try {
          const errorData = JSON.parse(responseText);
          console.error('[Tracker] Error response data:', errorData);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Not JSON, use the text as is
          if (responseText) {
            errorMessage = responseText;
          }
        }
      } catch {
        // If we can't read the response, use status text
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('[Tracker] Response data:', data);
    
    if (!data || !data.success) {
      throw new Error(data?.message || 'Failed to load tracker data');
    }
    
    if (!data.data) {
      throw new Error('Tracker data is missing from response');
    }
    
    const trackerData = data.data;
    
    console.log('[Tracker] Tracker data loaded successfully:', trackerData);
    console.log('[Tracker] Values:', {
      allTimeCompleted: trackerData.allTimeCompleted,
      currentCycleCount: trackerData.currentCycleCount,
      totalCalories: trackerData.totalCalories,
      rewardsAvailable: trackerData.rewardsAvailable
    });
    
    // Remove any existing error messages on successful load
    const existingError = document.querySelector('.tracker-error-message');
    if (existingError) {
      existingError.remove();
    }
    
    // Update session tracker
    console.log('[Tracker] Calling updateSessionTracker...');
    updateSessionTracker(trackerData);
    
    // Update calories tracker
    console.log('[Tracker] Calling updateCaloriesTracker...');
    updateCaloriesTracker(trackerData.totalCalories);
    
    // Store tracker data globally for use in booking
    window.trackerData = trackerData;
    console.log('[Tracker] Tracker data stored in window.trackerData');
    
  } catch (error) {
    console.error('[Tracker] Error loading tracker data:', error);
    console.error('[Tracker] Error stack:', error.stack);
    
    // Remove any existing error messages first
    const existingError = document.querySelector('.tracker-error-message');
    if (existingError) {
      existingError.remove();
    }
    
    // Only show error if it's not a network/CORS issue (which might be expected if API is down)
    if (error.message && !error.message.includes('Failed to fetch') && !error.message.includes('NetworkError')) {
      // Show error to user only for actual API errors
      const trackerContainer = document.querySelector('.row.mb-4');
      if (trackerContainer) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger tracker-error-message';
        errorDiv.textContent = 'Failed to load tracker data. Please refresh the page.';
        trackerContainer.insertBefore(errorDiv, trackerContainer.firstChild);
      }
    } else {
      // For network errors, just log to console (API might not be running)
      console.warn('[Tracker] Tracker data unavailable - API may not be running or network issue');
    }
  }
}

/**
 * Update session tracker display
 */
function updateSessionTracker(trackerData) {
  if (!trackerData) {
    console.error('No tracker data provided to updateSessionTracker');
    return;
  }
  
  const { allTimeCompleted, currentCycleCount, rewardsAvailable, hasFreeSession } = trackerData;
  
  console.log('Updating session tracker:', { allTimeCompleted, currentCycleCount, rewardsAvailable, hasFreeSession });
  
  // Update all-time completed
  const allTimeElement = document.getElementById('allTimeCompleted');
  if (allTimeElement) {
    allTimeElement.textContent = allTimeCompleted;
    console.log('Updated allTimeCompleted to:', allTimeCompleted);
  } else {
    console.error('allTimeCompleted element not found');
  }
  
  // Update current cycle count
  const currentCycleElement = document.getElementById('currentCycleCount');
  if (currentCycleElement) {
    currentCycleElement.textContent = currentCycleCount;
    console.log('Updated currentCycleCount to:', currentCycleCount);
  } else {
    console.error('currentCycleCount element not found');
  }
  
  // Update rewards available
  const rewardsElement = document.getElementById('rewardsAvailable');
  if (rewardsElement) {
    rewardsElement.textContent = rewardsAvailable;
    console.log('Updated rewardsAvailable to:', rewardsAvailable);
  } else {
    console.error('rewardsAvailable element not found');
  }
  
  // Update circular progress meter
  updateCircularProgress(currentCycleCount);
  
  // Show/hide free session badge
  const freeSessionBadge = document.getElementById('freeSessionBadge');
  if (freeSessionBadge) {
    if (hasFreeSession) {
      freeSessionBadge.style.display = 'block';
    } else {
      freeSessionBadge.style.display = 'none';
    }
  }
}

/**
 * Update circular progress meter
 */
function updateCircularProgress(currentCount) {
  const progressCircle = document.getElementById('progressCircle');
  if (!progressCircle) return;
  
  // Calculate progress (0-10)
  const maxValue = 10;
  const progress = Math.min(currentCount / maxValue, 1);
  
  // Calculate stroke-dashoffset
  // Circumference = 2 * π * r = 2 * π * 85 ≈ 534.07
  const circumference = 2 * Math.PI * 85;
  const offset = circumference - (progress * circumference);
  
  progressCircle.style.strokeDashoffset = offset;
  
  // Change color when at 10
  if (currentCount === 10) {
    progressCircle.style.stroke = '#4caf50'; // Green when complete
  } else {
    progressCircle.style.stroke = '#0d6efd'; // Blue for progress
  }
}

/**
 * Update calories tracker display
 */
function updateCaloriesTracker(totalCalories) {
  const caloriesElement = document.getElementById('totalCalories');
  if (caloriesElement) {
    caloriesElement.textContent = totalCalories.toLocaleString();
    console.log('Updated totalCalories to:', totalCalories);
  } else {
    console.error('totalCalories element not found');
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
      let errorMessage = 'Failed to fetch available sessions';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } else {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
      } catch {
        errorMessage = `Error ${response.status}: ${response.statusText || 'Unknown error'}`;
      }
      throw new Error(errorMessage);
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
    const formattedRate = sessionRate === 0 ? '<span class="text-success fw-bold">FREE 🎉</span>' : formatCurrency(sessionRate);
    
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
            <button class="btn btn-primary w-100" onclick="bookSession(${session.availabilityId}, '${session.calculatedDate}', '${session.trainerName}', '${session.specialtyName}', '${session.dayOfWeek}', '${formattedTime}', '${formattedDate}', ${sessionRate})">
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
      
      // Reload sessions and tracker data
      await loadMySessions();
      await loadTrackerData();
      
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
function bookSession(availabilityId, calculatedDate, trainerName, specialtyName, dayOfWeek, formattedTime, formattedDate, sessionRate) {
  const bookingModal = new bootstrap.Modal(document.getElementById('bookingModal'));
  const bookingConfirmText = document.getElementById('bookingConfirmText');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  
  // Check if this is a free session (rate is 0 or client has free session reward)
  const hasFreeSession = window.trackerData && window.trackerData.hasFreeSession;
  const isFreeSession = parseFloat(sessionRate) === 0 || hasFreeSession;
  
  let bookingMessage = `Are you sure you want to book a session with ${trainerName} for ${specialtyName} on ${dayOfWeek}, ${formattedDate} at ${formattedTime}?`;
  if (isFreeSession) {
    bookingMessage += `\n\n🎉 This session will be FREE (using your reward)!`;
  } else {
    bookingMessage += `\n\nPrice: ${formatCurrency(sessionRate)}`;
  }
  
  bookingConfirmText.textContent = bookingMessage;
  
  // Remove previous event listeners
  const newConfirmBtn = confirmBookingBtn.cloneNode(true);
  confirmBookingBtn.parentNode.replaceChild(newConfirmBtn, confirmBookingBtn);
  
  // Add new event listener
  newConfirmBtn.addEventListener('click', async () => {
    await confirmBooking(availabilityId, calculatedDate, bookingModal, isFreeSession);
  });
  
  bookingModal.show();
}

/**
 * Confirm booking
 */
async function confirmBooking(availabilityId, calculatedDate, modal, useFreeSession = false) {
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
        calculatedDate: calculatedDate,
        useFreeSession: useFreeSession
      }),
    });
    
    const data = await response.json();
    
    console.log('Booking response:', data);
    
    if (data.success) {
      // Close modal
      modal.hide();
      
      console.log('Session booked successfully, sessionId:', data.sessionId, 'Status:', data.status, 'Total Completed:', data.totalCompleted);
      
      // Immediately update tracker with the data from booking response if available
      if (data.totalCompleted !== undefined && data.totalCompleted !== null) {
        console.log('Updating tracker immediately with booking response data...', {
          totalCompleted: data.totalCompleted,
          status: data.status,
          sessionId: data.sessionId
        });
        
        // Calculate tracker values from totalCompleted
        const allTimeCompleted = parseInt(data.totalCompleted) || 0;
        const currentCycleCount = allTimeCompleted % 10;
        const cyclesCompleted = Math.floor(allTimeCompleted / 10);
        
        console.log('Calculated values:', { allTimeCompleted, currentCycleCount, cyclesCompleted });
        
        // Update the display immediately
        const allTimeElement = document.getElementById('allTimeCompleted');
        if (allTimeElement) {
          allTimeElement.textContent = allTimeCompleted;
          console.log('Updated allTimeCompleted element to:', allTimeCompleted);
        } else {
          console.error('allTimeCompleted element not found!');
        }
        
        const currentCycleElement = document.getElementById('currentCycleCount');
        if (currentCycleElement) {
          currentCycleElement.textContent = currentCycleCount;
          console.log('Updated currentCycleCount element to:', currentCycleCount);
        } else {
          console.error('currentCycleCount element not found!');
        }
        
        // Update circular progress
        updateCircularProgress(currentCycleCount);
        console.log('Updated circular progress to:', currentCycleCount);
      } else {
        console.warn('No totalCompleted in booking response:', data);
      }
      
      // Small delay to ensure database commit completes, then reload full tracker data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reload full tracker data from server (this will get accurate calories, rewards, etc.)
      console.log('Reloading full tracker data from server...');
      await loadTrackerData();
      
      // Reload find sessions
      await loadFindSessions();
      
      // Switch to My Sessions tab
      const mySessionsTab = document.getElementById('mySessions-tab');
      if (mySessionsTab) {
        mySessionsTab.click();
        await loadMySessions();
      }
      
      const successMessage = useFreeSession 
        ? 'Session booked successfully using your free session reward! 🎉'
        : 'Session booked successfully!';
      alert(successMessage);
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
      // Reload sessions and tracker data
      await loadMySessions();
      await loadTrackerData();
      
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


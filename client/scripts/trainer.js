// Trainer Portal JavaScript

// API_BASE_URL is declared in profile.js (shared across all pages)

// Initialize trainer page
document.addEventListener('DOMContentLoaded', function() {
  initializeTrainerPage();
});

/**
 * Initialize the trainer page
 */
function initializeTrainerPage() {
  // Update navbar auth state (ensures profile icon/logout are shown)
  if (typeof updateNavbarAuthState === 'function') {
    updateNavbarAuthState();
  }
  
  // Check if trainer is signed in and update navbar
  checkTrainerAuth();
  
  // Load trainer data (read-only)
  loadTrainerData();
}

/**
 * Check if trainer is signed in and show/hide Trainer Portal nav link
 */
function checkTrainerAuth() {
  // Check localStorage for authentication
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userRole = localStorage.getItem('userRole');
  
  const trainerPortalNavItem = document.getElementById('trainerPortalNavItem');
  
  if (trainerPortalNavItem) {
    // Show Trainer Portal link if trainer is signed in
    if (isAuthenticated && userRole === 'Trainer') {
      trainerPortalNavItem.style.display = 'block';
    } else {
      trainerPortalNavItem.style.display = 'none';
    }
  }
}

/**
 * Load all trainer data from API (read-only)
 */
async function loadTrainerData() {
  try {
    // Load profile data
    await loadProfileData();
    
    // Load availability data for the active tab
    const scheduleTab = document.getElementById('scheduleTab');
    if (scheduleTab && scheduleTab.classList.contains('active')) {
    await loadAvailabilityData();
    }
    
    // Load sessions data for the active tab
    const sessionsTab = document.getElementById('sessionsTab');
    if (sessionsTab && sessionsTab.classList.contains('active')) {
    await loadSessionsData();
    }
  } catch (error) {
    console.error('Error loading trainer data:', error);
  }
}

/**
 * Load and display trainer profile data (read-only)
 */
async function loadProfileData() {
  const profileDataContainer = document.getElementById('profileData');
  
  if (!profileDataContainer) return;
  
  try {
    // Placeholder: This will be replaced with actual API call
    // Example: const response = await fetch(`${API_BASE_URL}/trainer/profile`);
    // const data = await response.json();
    
    // For now, display placeholder message
    // TODO: Replace with actual API endpoint when available
    profileDataContainer.innerHTML = `
      <div class="table-responsive">
        <table class="table table-dark table-striped">
          <tbody>
            <tr>
              <th scope="row">Name</th>
              <td id="trainerProfileName">-</td>
            </tr>
            <tr>
              <th scope="row">Email</th>
              <td id="trainerProfileEmail">-</td>
            </tr>
            <tr>
              <th scope="row">Phone</th>
              <td id="trainerProfilePhone">-</td>
            </tr>
            <tr>
              <th scope="row">Certifications</th>
              <td id="trainerProfileCertifications">-</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-muted small mt-2">Note: This is a read-only view. Edit functionality will be added later.</p>
    `;
    
    // TODO: Fetch actual data from API
    // Example implementation:
    // const trainerId = getTrainerId(); // Get from auth
    // const response = await fetch(`${API_BASE_URL}/trainer/${trainerId}/profile`);
    // if (response.ok) {
    //   const data = await response.json();
    //   document.getElementById('profileName').textContent = `${data.firstName} ${data.lastName}`;
    //   document.getElementById('profileEmail').textContent = data.email;
    //   document.getElementById('profilePhone').textContent = data.phone || 'Not provided';
    //   document.getElementById('profileCertifications').textContent = data.certification || 'None';
    // }
    
  } catch (error) {
    console.error('Error loading profile data:', error);
    profileDataContainer.innerHTML = '<p class="text-danger">Error loading profile data. Please try again later.</p>';
  }
}

// Store availability data and specialties globally
let availabilityList = [];
let trainerSpecialties = [];

/**
 * Load and display availability schedule data
 */
async function loadAvailabilityData() {
  const availabilityDataContainer = document.getElementById('availabilityData');
  
  if (!availabilityDataContainer) return;
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    availabilityDataContainer.innerHTML = '<p class="text-danger">Please log in to view availability.</p>';
    return;
  }

  try {
    // Fetch availability data
    const availabilityResponse = await fetch(`${API_BASE_URL}/trainer/availability?email=${encodeURIComponent(userEmail)}`);
    
    if (!availabilityResponse.ok) {
      throw new Error('Failed to fetch availability data');
    }
    
    const availabilityData = await availabilityResponse.json();
    
    if (!availabilityData.success) {
      throw new Error(availabilityData.message || 'Failed to load availability');
    }
    
    availabilityList = availabilityData.data || [];
    
    // Fetch trainer specialties
    const specialtiesResponse = await fetch(`${API_BASE_URL}/trainer/specialties?email=${encodeURIComponent(userEmail)}`);
    
    if (!specialtiesResponse.ok) {
      throw new Error('Failed to fetch specialties');
    }
    
    const specialtiesData = await specialtiesResponse.json();
    
    if (!specialtiesData.success) {
      throw new Error(specialtiesData.message || 'Failed to load specialties');
    }
    
    trainerSpecialties = specialtiesData.data || [];
    
    // Render calendar view
    renderAvailabilityCalendar(availabilityList, trainerSpecialties);
    
  } catch (error) {
    console.error('Error loading availability data:', error);
    availabilityDataContainer.innerHTML = '<p class="text-danger">Error loading availability data. Please try again later.</p>';
  }
}

/**
 * Load and display booked sessions data
 */
async function loadSessionsData() {
  const sessionsDataContainer = document.getElementById('sessionsData');
  
  if (!sessionsDataContainer) return;
  
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    sessionsDataContainer.innerHTML = '<p class="text-danger">Please log in to view sessions.</p>';
    return;
  }

  try {
    // Fetch sessions data
    const response = await fetch(`${API_BASE_URL}/trainer/sessions?email=${encodeURIComponent(userEmail)}`);
    
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
              <th>Client Name</th>
              <th>Specialty</th>
              <th>Room</th>
              <th>Price</th>
              <th>Status</th>
              <th>Payment Status</th>
              <th>Booking Date</th>
            </tr>
          </thead>
          <tbody id="sessionsTableBody">
          </tbody>
        </table>
      </div>
    `;
    
    const tbody = document.getElementById('sessionsTableBody');
    tbody.innerHTML = sessionsList.map(session => {
      const statusBadge = getStatusBadge(session.status);
      const paymentBadge = getPaymentStatusBadge(session.paymentStatus);
      const formattedDate = formatDate(session.sessionDate);
      const formattedTime = formatTime(session.startTime);
      const formattedPrice = formatCurrency(session.price);
      const formattedBookingDate = session.bookingDate ? formatDateTime(session.bookingDate) : 'N/A';
      
      return `
        <tr>
          <td>${formattedDate}</td>
          <td>${formattedTime}</td>
          <td>${session.clientName}</td>
          <td>${session.specialtyName}</td>
          <td>${session.roomName || 'Not assigned'}</td>
          <td>${formattedPrice}</td>
          <td>${statusBadge}</td>
          <td>${paymentBadge}</td>
          <td>${formattedBookingDate}</td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading sessions data:', error);
    sessionsDataContainer.innerHTML = '<p class="text-danger">Error loading sessions data. Please try again later.</p>';
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

// Note: loadPaymentData() function removed - payment information is now shown in the Booked Sessions tab

/**
 * Render weekly availability calendar
 */
function renderAvailabilityCalendar(availabilityList, specialties) {
  const availabilityDataContainer = document.getElementById('availabilityData');
  if (!availabilityDataContainer) return;

  // Generate hourly time slots (6 AM to 10 PM)
  const timeSlots = [];
  for (let hour = 6; hour <= 22; hour++) {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    timeSlots.push(timeStr);
  }

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Create a map for quick lookup: day-time -> availability
  const availabilityMap = new Map();
  availabilityList.forEach(avail => {
    const key = `${avail.dayOfWeek}-${avail.startTime}`;
    availabilityMap.set(key, avail);
  });

  // Build calendar HTML
  let calendarHTML = `
    <div class="table-responsive">
      <table class="table table-bordered table-hover">
        <thead class="table-dark">
          <tr>
            <th style="width: 100px;">Time</th>
            ${daysOfWeek.map(day => `<th>${day}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  timeSlots.forEach(time => {
    calendarHTML += '<tr>';
    calendarHTML += `<td class="fw-bold">${formatTime(time)}</td>`;
    
    daysOfWeek.forEach(day => {
      const key = `${day}-${time}`;
      const availability = availabilityMap.get(key);
      
      if (availability) {
        const statusClass = availability.isBooked ? 'bg-danger' : 'bg-success';
        const statusText = availability.isBooked ? 'Booked' : 'Available';
        calendarHTML += `
          <td class="text-center p-2">
            <div class="card ${statusClass} text-white mb-0" style="cursor: pointer;" 
                 onclick="${availability.isBooked ? '' : `openEditAvailabilityModal(${availability.availabilityId})`}">
              <div class="card-body p-2">
                <small class="d-block fw-bold">${availability.specialtyName}</small>
                <small class="d-block">${statusText}</small>
                ${!availability.isBooked ? `<button class="btn btn-sm btn-danger mt-1" onclick="event.stopPropagation(); deleteAvailabilitySlot(${availability.availabilityId})">Delete</button>` : ''}
              </div>
            </div>
          </td>
        `;
      } else {
        calendarHTML += `
          <td class="text-center p-2" style="cursor: pointer;" 
              onclick="openAddAvailabilityModal('${day}', '${time}')">
            <div class="card bg-secondary text-white mb-0" style="opacity: 0.5;">
              <div class="card-body p-2">
                <small>Click to add</small>
              </div>
            </div>
          </td>
        `;
      }
    });
    
    calendarHTML += '</tr>';
  });

  calendarHTML += `
        </tbody>
      </table>
    </div>
  `;

  availabilityDataContainer.innerHTML = calendarHTML;
}

/**
 * Format time from HH:MM to 12-hour format
 */
function formatTime(time24) {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Populate time slots dropdown
 */
function populateTimeSlots() {
  const timeSelect = document.getElementById('availabilityStartTime');
  if (!timeSelect) return;

  // Clear existing options except the first one
  while (timeSelect.options.length > 1) {
    timeSelect.remove(1);
  }

  // Add hourly slots (6 AM to 10 PM)
  for (let hour = 6; hour <= 22; hour++) {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    const option = document.createElement('option');
    option.value = timeStr;
    option.textContent = formatTime(timeStr);
    timeSelect.appendChild(option);
  }
}

/**
 * Populate specialties dropdown
 */
function populateSpecialties() {
  const specialtySelect = document.getElementById('availabilitySpecialty');
  if (!specialtySelect) return;

  // Clear existing options except the first one
  while (specialtySelect.options.length > 1) {
    specialtySelect.remove(1);
  }

  // Add trainer specialties
  trainerSpecialties.forEach(specialty => {
    const option = document.createElement('option');
    option.value = specialty.specialtyId;
    option.textContent = specialty.specialtyName;
    specialtySelect.appendChild(option);
  });
}

/**
 * Open add availability modal
 */
function openAddAvailabilityModal(dayOfWeek = null, startTime = null) {
  const modal = new bootstrap.Modal(document.getElementById('availabilityModal'));
  const modalLabel = document.getElementById('availabilityModalLabel');
  const submitBtn = document.getElementById('availabilitySubmitBtn');
  const form = document.getElementById('availabilityForm');
  
  // Reset form
  form.reset();
  form.classList.remove('was-validated');
  
  // Set modal title and button text
  modalLabel.textContent = 'Add Availability';
  submitBtn.textContent = 'Add Availability';
  submitBtn.setAttribute('data-mode', 'add');
  
  // Populate dropdowns
  populateTimeSlots();
  populateSpecialties();
  
  // Pre-fill if day and time provided
  if (dayOfWeek) {
    document.getElementById('availabilityDayOfWeek').value = dayOfWeek;
  }
  if (startTime) {
    document.getElementById('availabilityStartTime').value = startTime;
  }
  
  modal.show();
}

/**
 * Open edit availability modal
 */
function openEditAvailabilityModal(availabilityId) {
  const availability = availabilityList.find(avail => avail.availabilityId === availabilityId);
  if (!availability) {
    alert('Availability not found');
    return;
  }

  const modal = new bootstrap.Modal(document.getElementById('availabilityModal'));
  const modalLabel = document.getElementById('availabilityModalLabel');
  const submitBtn = document.getElementById('availabilitySubmitBtn');
  const form = document.getElementById('availabilityForm');
  
  // Reset form
  form.reset();
  form.classList.remove('was-validated');
  
  // Set modal title and button text
  modalLabel.textContent = 'Edit Availability';
  submitBtn.textContent = 'Update Availability';
  submitBtn.setAttribute('data-mode', 'edit');
  submitBtn.setAttribute('data-availability-id', availabilityId);
  
  // Populate dropdowns
  populateTimeSlots();
  populateSpecialties();
  
  // Pre-fill with current values
  document.getElementById('availabilityDayOfWeek').value = availability.dayOfWeek;
  document.getElementById('availabilityStartTime').value = availability.startTime;
  document.getElementById('availabilitySpecialty').value = availability.specialtyId;
  
  modal.show();
}

/**
 * Handle availability form submission
 */
async function handleAvailabilitySubmit(event) {
  event.preventDefault();
  event.stopPropagation();

  const form = event.target;
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const submitBtn = document.getElementById('availabilitySubmitBtn');
  const mode = submitBtn.getAttribute('data-mode');
  const availabilityId = submitBtn.getAttribute('data-availability-id');

  const formData = {
    dayOfWeek: document.getElementById('availabilityDayOfWeek').value,
    startTime: document.getElementById('availabilityStartTime').value,
    specialtyId: parseInt(document.getElementById('availabilitySpecialty').value)
  };

  try {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      alert('Please log in to manage availability');
      return;
    }

    let response;
    if (mode === 'edit') {
      // Update existing availability
      response = await fetch(`${API_BASE_URL}/trainer/availability/${availabilityId}?email=${encodeURIComponent(userEmail)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
    } else {
      // Add new availability
      response = await fetch(`${API_BASE_URL}/trainer/availability?email=${encodeURIComponent(userEmail)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
    }

    if (!response.ok) {
      let errorMessage = 'Failed to save availability. Please try again.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = `Error ${response.status}: ${response.statusText || 'Unknown error'}`;
      }
      alert(errorMessage);
      return;
    }

    const data = await response.json();
    if (data.success) {
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('availabilityModal'));
      modal.hide();
      
      // Reload availability data
      await loadAvailabilityData();
      
      alert(mode === 'edit' ? 'Availability updated successfully!' : 'Availability added successfully!');
    } else {
      alert(data.message || 'Failed to save availability. Please try again.');
    }
  } catch (error) {
    console.error('Error saving availability:', error);
    alert('An error occurred while saving availability. Please try again.');
  }
}

/**
 * Delete availability slot
 */
async function deleteAvailabilitySlot(availabilityId) {
  if (!confirm('Are you sure you want to delete this availability slot?')) {
    return;
  }

  try {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      alert('Please log in to manage availability');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/trainer/availability/${availabilityId}?email=${encodeURIComponent(userEmail)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to delete availability. Please try again.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = `Error ${response.status}: ${response.statusText || 'Unknown error'}`;
      }
      alert(errorMessage);
      return;
    }

    const data = await response.json();
    if (data.success) {
      // Reload availability data
      await loadAvailabilityData();
      alert('Availability deleted successfully!');
    } else {
      alert(data.message || 'Failed to delete availability. Please try again.');
    }
  } catch (error) {
    console.error('Error deleting availability:', error);
    alert('An error occurred while deleting availability. Please try again.');
  }
}

/**
 * Setup tab change handlers
 */
function setupTabHandlers() {
  // Use the tab content container to listen for tab changes
  const tabContent = document.getElementById('trainerTabContent');
  
  if (tabContent) {
    // Listen for Bootstrap tab shown event on the tab content
    tabContent.addEventListener('shown.bs.tab', function(event) {
      const targetId = event.target.getAttribute('data-bs-target');
      
      if (targetId === '#scheduleTab') {
        loadAvailabilityData();
      } else if (targetId === '#sessionsTab') {
        loadSessionsData();
      }
    });
  }
  
  // Also listen directly on the tab buttons as a fallback
  const scheduleTab = document.getElementById('schedule-tab');
  const sessionsTab = document.getElementById('sessions-tab');
  
  if (scheduleTab) {
    scheduleTab.addEventListener('shown.bs.tab', function() {
      loadAvailabilityData();
    });
  }
  
  if (sessionsTab) {
    sessionsTab.addEventListener('shown.bs.tab', function() {
      loadSessionsData();
    });
  }
}

// Make functions globally available
window.openAddAvailabilityModal = openAddAvailabilityModal;
window.openEditAvailabilityModal = openEditAvailabilityModal;
window.handleAvailabilitySubmit = handleAvailabilitySubmit;
window.deleteAvailabilitySlot = deleteAvailabilitySlot;
window.loadSessionsData = loadSessionsData;
window.loadAvailabilityData = loadAvailabilityData;


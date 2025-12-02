// Profile Management JavaScript - Shared across all pages

const API_BASE_URL = 'http://localhost:5176/api';

// Store original values for revert functionality
let originalProfileValues = {};

/**
 * Initialize profile management on page load
 */
function initializeProfileOnLoad() {
  updateNavbarAuthState();
  initializeProfileModal();
}

// Run on DOMContentLoaded (when DOM is ready)
document.addEventListener('DOMContentLoaded', initializeProfileOnLoad);

// Also run on window load (when all resources are loaded) as a fallback
window.addEventListener('load', function() {
  updateNavbarAuthState();
});

// If DOM is already loaded when script runs, execute immediately
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // Use setTimeout to ensure it runs after current execution stack
  setTimeout(initializeProfileOnLoad, 0);
}

/**
 * Update navbar to show profile image/logout when logged in, or login/create account when not
 */
function updateNavbarAuthState() {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const createAccountNav = document.getElementById('createAccountNav');
  const loginNav = document.getElementById('loginNav');
  const profileImageNav = document.getElementById('profileImageNav');
  const logoutNav = document.getElementById('logoutNav');
  const trainerPortalNavItem = document.getElementById('trainerPortalNavItem');
  const clientPortalNavItem = document.getElementById('clientPortalNavItem');
  const adminPortalNavItem = document.getElementById('adminPortalNavItem');
  const findTrainersNav = document.getElementById('findTrainersNav');
  const mySessionsNav = document.getElementById('mySessionsNav');

  if (isAuthenticated) {
    // Hide login/create account
    if (createAccountNav) createAccountNav.style.display = 'none';
    if (loginNav) loginNav.style.display = 'none';
    
    // Hide default nav items (Find Trainers, My Sessions)
    if (findTrainersNav) findTrainersNav.style.display = 'none';
    if (mySessionsNav) mySessionsNav.style.display = 'none';
    
    // Show profile image and logout
    if (profileImageNav) profileImageNav.style.display = 'block';
    if (logoutNav) logoutNav.style.display = 'block';
    
    // Update profile image initials
    updateProfileImage();
    
    // Show portal links based on user role
    const userRole = localStorage.getItem('userRole');
    if (trainerPortalNavItem) {
      trainerPortalNavItem.style.display = (userRole === 'Trainer') ? 'block' : 'none';
    }
    if (clientPortalNavItem) {
      clientPortalNavItem.style.display = (userRole === 'Client') ? 'block' : 'none';
    }
    if (adminPortalNavItem) {
      adminPortalNavItem.style.display = (userRole === 'Admin') ? 'block' : 'none';
    }
  } else {
    // Show login/create account
    if (createAccountNav) createAccountNav.style.display = 'block';
    if (loginNav) loginNav.style.display = 'block';
    
    // Hide profile image and logout
    if (profileImageNav) profileImageNav.style.display = 'none';
    if (logoutNav) logoutNav.style.display = 'none';
    
    // Hide portal links
    if (trainerPortalNavItem) trainerPortalNavItem.style.display = 'none';
    if (clientPortalNavItem) clientPortalNavItem.style.display = 'none';
    if (adminPortalNavItem) adminPortalNavItem.style.display = 'none';
    
    // Hide default nav items when not logged in (they're not in simplified navbar)
    if (findTrainersNav) findTrainersNav.style.display = 'none';
    if (mySessionsNav) mySessionsNav.style.display = 'none';
  }
}

/**
 * Update profile image with user initials
 */
function updateProfileImage() {
  const profileInitials = document.getElementById('profileInitials');
  if (profileInitials) {
    const firstName = localStorage.getItem('userFirstName') || '';
    const lastName = localStorage.getItem('userLastName') || '';
    const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
    profileInitials.textContent = initials;
  }
}

/**
 * Initialize profile modal with user data
 */
function initializeProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (!profileModal) return;

  // Load user data when modal is shown
  profileModal.addEventListener('show.bs.modal', function() {
    loadUserProfileData();
  });
}

/**
 * Load user profile data from storage/API
 */
async function loadUserProfileData() {
  const userEmail = localStorage.getItem('userEmail');
  const userRole = localStorage.getItem('userRole');
  
  if (!userEmail || !userRole) {
    console.error('User not authenticated');
    return;
  }

  try {
    // Fetch full profile data from API
    const response = await fetch(`${API_BASE_URL}/auth/profile?email=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch profile data');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load profile');
    }
    
    // Populate form fields
    const profileFirstName = document.getElementById('profileFirstName');
    const profileLastName = document.getElementById('profileLastName');
    const profileEmail = document.getElementById('profileEmail');
    const profileBirthday = document.getElementById('profileBirthday');
    const profilePhone = document.getElementById('profilePhone');
    const profileCertification = document.getElementById('profileCertification');
    const profileRate = document.getElementById('profileRate');
    const profilePhoneGroup = document.getElementById('profilePhoneGroup');
    const profileCertificationGroup = document.getElementById('profileCertificationGroup');
    const profileRateGroup = document.getElementById('profileRateGroup');
    const profilePasswordGroup = document.getElementById('profilePasswordGroup');

    // Show/hide fields based on user role FIRST (before setting values)
    if (userRole === 'Client' || userRole === 'Trainer') {
      if (profilePhoneGroup) profilePhoneGroup.style.display = 'block';
    } else {
      if (profilePhoneGroup) profilePhoneGroup.style.display = 'none';
    }

    if (userRole === 'Trainer') {
      if (profileCertificationGroup) profileCertificationGroup.style.display = 'block';
      if (profileRateGroup) profileRateGroup.style.display = 'block';
      // Load specialties for trainers
      await loadTrainerSpecialties(userEmail);
    } else {
      if (profileCertificationGroup) profileCertificationGroup.style.display = 'none';
      if (profileRateGroup) profileRateGroup.style.display = 'none';
      const profileSpecialtiesGroup = document.getElementById('profileSpecialtiesGroup');
      if (profileSpecialtiesGroup) profileSpecialtiesGroup.style.display = 'none';
    }

    // Hide password field in read-only mode
    if (profilePasswordGroup) profilePasswordGroup.style.display = 'none';
    
    // Store original values FIRST (before setting any field values)
    originalProfileValues = {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || userEmail || '',
      birthday: data.birthday || '',
      phone: data.phone || '',
      certification: data.certification || '',
      rate: data.rate !== undefined && data.rate !== null ? parseFloat(data.rate) : 0.00
    };
    
    // NOW set all field values directly from API data (same pattern for all fields)
    if (profileFirstName) profileFirstName.value = originalProfileValues.firstName;
    if (profileLastName) profileLastName.value = originalProfileValues.lastName;
    if (profileEmail) profileEmail.value = originalProfileValues.email;
    if (profileBirthday) profileBirthday.value = originalProfileValues.birthday;
    if (profilePhone) profilePhone.value = originalProfileValues.phone;
    if (profileCertification) profileCertification.value = originalProfileValues.certification;
    if (profileRate) profileRate.value = originalProfileValues.rate.toFixed(2);
    
    // Ensure all fields are readonly initially
    switchToReadOnlyMode();
    
  } catch (error) {
    console.error('Error loading profile data:', error);
    // Fallback to localStorage data if API fails
    const firstName = localStorage.getItem('userFirstName') || '';
    const lastName = localStorage.getItem('userLastName') || '';
    
    const profileFirstName = document.getElementById('profileFirstName');
    const profileLastName = document.getElementById('profileLastName');
    const profileEmail = document.getElementById('profileEmail');
    
    if (profileFirstName) profileFirstName.value = firstName;
    if (profileLastName) profileLastName.value = lastName;
    if (profileEmail) profileEmail.value = userEmail;
    
    alert('Failed to load full profile data. Some fields may be incomplete.');
  }
}

/**
 * Switch to edit mode
 */
function switchToEditMode() {
  const profileFirstName = document.getElementById('profileFirstName');
  const profileLastName = document.getElementById('profileLastName');
  const profileBirthday = document.getElementById('profileBirthday');
  const profilePhone = document.getElementById('profilePhone');
  const profileCertification = document.getElementById('profileCertification');
  const profileRate = document.getElementById('profileRate');
  const profilePassword = document.getElementById('profilePassword');
  const profilePasswordGroup = document.getElementById('profilePasswordGroup');
  const profileModalLabel = document.getElementById('profileModalLabel');
  const readOnlyButtons = document.getElementById('readOnlyButtons');
  const editButtons = document.getElementById('editButtons');
  const profileForm = document.getElementById('profileForm');

  // Store current values as original before editing (preserve email)
  const profileEmail = document.getElementById('profileEmail');
  originalProfileValues = {
    email: profileEmail ? profileEmail.value : (originalProfileValues.email || localStorage.getItem('userEmail') || ''),
    firstName: profileFirstName ? profileFirstName.value : '',
    lastName: profileLastName ? profileLastName.value : '',
    birthday: profileBirthday ? profileBirthday.value : '',
    phone: profilePhone ? profilePhone.value : '',
    certification: profileCertification ? profileCertification.value : '',
    rate: profileRate ? parseFloat(profileRate.value) || 0.00 : 0.00
  };

  // Enable all editable fields
  if (profileFirstName) profileFirstName.removeAttribute('readonly');
  if (profileLastName) profileLastName.removeAttribute('readonly');
  if (profileBirthday) profileBirthday.removeAttribute('readonly');
  if (profilePhone) profilePhone.removeAttribute('readonly');
  if (profileCertification) profileCertification.removeAttribute('readonly');
  if (profileRate) profileRate.removeAttribute('readonly');
  if (profilePassword) {
    profilePassword.removeAttribute('readonly');
    profilePassword.value = ''; // Clear password field when entering edit mode
  }

  // Show password field in edit mode
  if (profilePasswordGroup) profilePasswordGroup.style.display = 'block';

  // Enable specialty checkboxes for trainers
  const userRole = localStorage.getItem('userRole');
  if (userRole === 'Trainer') {
    const specialtyCheckboxes = document.querySelectorAll('#profileSpecialtiesContainer input[type="checkbox"]');
    specialtyCheckboxes.forEach(checkbox => {
      checkbox.removeAttribute('disabled');
    });
  }

  // Update modal title
  if (profileModalLabel) profileModalLabel.textContent = 'Edit Profile';

  // Switch button visibility
  if (readOnlyButtons) readOnlyButtons.classList.add('d-none');
  if (editButtons) editButtons.classList.remove('d-none');

  // Remove validation state
  if (profileForm) profileForm.classList.remove('was-validated');
}

/**
 * Switch to read-only mode
 */
function switchToReadOnlyMode() {
  const profileFirstName = document.getElementById('profileFirstName');
  const profileLastName = document.getElementById('profileLastName');
  const profileEmail = document.getElementById('profileEmail');
  const profileBirthday = document.getElementById('profileBirthday');
  const profilePhone = document.getElementById('profilePhone');
  const profileCertification = document.getElementById('profileCertification');
  const profileRate = document.getElementById('profileRate');
  const profilePassword = document.getElementById('profilePassword');
  const profilePasswordGroup = document.getElementById('profilePasswordGroup');
  const profileModalLabel = document.getElementById('profileModalLabel');
  const readOnlyButtons = document.getElementById('readOnlyButtons');
  const editButtons = document.getElementById('editButtons');
  const profileForm = document.getElementById('profileForm');

  // Restore original values (set all fields the same way)
  if (profileFirstName) {
    profileFirstName.value = originalProfileValues.firstName || '';
  }
  if (profileLastName) {
    profileLastName.value = originalProfileValues.lastName || '';
  }
  if (profileEmail) {
    profileEmail.value = originalProfileValues.email || '';
  }
  if (profileBirthday) {
    profileBirthday.value = originalProfileValues.birthday || '';
  }
  if (profilePhone) {
    profilePhone.value = originalProfileValues.phone || '';
  }
  if (profileCertification) {
    profileCertification.value = originalProfileValues.certification || '';
  }
  if (profileRate) {
    profileRate.value = (originalProfileValues.rate || 0.00).toFixed(2);
  }
  if (profilePassword) {
    profilePassword.value = '';
  }

  // Make all fields readonly
  if (profileFirstName) profileFirstName.setAttribute('readonly', 'readonly');
  if (profileLastName) profileLastName.setAttribute('readonly', 'readonly');
  if (profileEmail) profileEmail.setAttribute('readonly', 'readonly');
  if (profileBirthday) profileBirthday.setAttribute('readonly', 'readonly');
  if (profilePhone) profilePhone.setAttribute('readonly', 'readonly');
  if (profileCertification) profileCertification.setAttribute('readonly', 'readonly');
  if (profileRate) profileRate.setAttribute('readonly', 'readonly');
  if (profilePassword) profilePassword.setAttribute('readonly', 'readonly');

  // Hide password field in read-only mode
  if (profilePasswordGroup) profilePasswordGroup.style.display = 'none';

  // Disable specialty checkboxes in read-only mode
  const userRole = localStorage.getItem('userRole');
  if (userRole === 'Trainer') {
    const specialtyCheckboxes = document.querySelectorAll('#profileSpecialtiesContainer input[type="checkbox"]');
    specialtyCheckboxes.forEach(checkbox => {
      checkbox.setAttribute('disabled', 'disabled');
    });
  }

  // Update modal title
  if (profileModalLabel) profileModalLabel.textContent = 'View Profile';

  // Switch button visibility
  if (readOnlyButtons) readOnlyButtons.classList.remove('d-none');
  if (editButtons) editButtons.classList.add('d-none');

  // Remove validation state
  if (profileForm) profileForm.classList.remove('was-validated');
}

/**
 * Handle profile form submission
 */
async function handleProfileSubmit(event) {
  event.preventDefault();
  event.stopPropagation();

  const form = event.target;
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const userEmail = localStorage.getItem('userEmail');
  const userRole = localStorage.getItem('userRole');
  
  if (!userEmail || !userRole) {
    alert('User not authenticated');
    return;
  }

  const formData = {
    email: userEmail,
    firstName: document.getElementById('profileFirstName').value.trim(),
    lastName: document.getElementById('profileLastName').value.trim(),
    birthday: document.getElementById('profileBirthday').value,
    password: document.getElementById('profilePassword').value || null,
  };

  // Add role-specific fields
  if (userRole === 'Client' || userRole === 'Trainer') {
    formData.phone = document.getElementById('profilePhone').value.trim() || null;
  }

  if (userRole === 'Trainer') {
    formData.certification = document.getElementById('profileCertification').value.trim() || null;
    const rateInput = document.getElementById('profileRate');
    if (rateInput) {
      const rateValue = parseFloat(rateInput.value);
      formData.rate = isNaN(rateValue) || rateValue < 0 ? null : rateValue;
    }
    
    // Get selected specialties
    const specialtyCheckboxes = document.querySelectorAll('#profileSpecialtiesContainer input[type="checkbox"]:checked');
    formData.specialtyIds = Array.from(specialtyCheckboxes).map(cb => parseInt(cb.value));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      // Try to parse error response, but handle empty responses
      let errorMessage = 'Failed to update profile. Please try again.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If response is not JSON (e.g., 404), use status text
        errorMessage = `Error ${response.status}: ${response.statusText || 'Not Found'}`;
      }
      alert(errorMessage);
      return;
    }

    const data = await response.json();

    if (data.success) {
      // Update localStorage
      if (formData.firstName) localStorage.setItem('userFirstName', formData.firstName);
      if (formData.lastName) localStorage.setItem('userLastName', formData.lastName);
      
      // Get current email from form (it's readonly so it shouldn't change)
      const profileEmail = document.getElementById('profileEmail');
      const currentEmail = profileEmail ? profileEmail.value : localStorage.getItem('userEmail') || '';
      
      // Update original values (preserve email)
      originalProfileValues = {
        email: currentEmail,
        firstName: formData.firstName,
        lastName: formData.lastName,
        birthday: formData.birthday,
        phone: formData.phone || '',
        certification: formData.certification || '',
        rate: formData.rate !== undefined && formData.rate !== null ? parseFloat(formData.rate) : (originalProfileValues.rate || 0.00)
      };
      
      // Update specialties for trainers
      if (userRole === 'Trainer' && formData.specialtyIds) {
        await updateTrainerSpecialties(userEmail, formData.specialtyIds);
      }
      
      // Update profile image
      updateProfileImage();
      
      // Switch back to read-only mode
      switchToReadOnlyMode();
      
      // Show success message in modal
      showSuccessModal('Profile updated successfully!');
    } else {
      alert(data.message || 'Failed to update profile. Please try again.');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    alert('An error occurred while updating your profile. Please try again.');
  }
}

/**
 * Handle account deletion
 */
async function handleDeleteAccount() {
  if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    return;
  }

  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    alert('User not authenticated');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: userEmail }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to delete account. Please try again.';
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
      alert(errorMessage);
      return;
    }

    const data = await response.json();
    
    if (data.success) {
      // Clear authentication state
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to home page
      window.location.href = './index.html';
    } else {
      alert(data.message || 'Failed to delete account. Please try again.');
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    alert('An error occurred while deleting your account. Please try again.');
  }
}

/**
 * Load trainer specialties (all available and trainer's current)
 */
async function loadTrainerSpecialties(userEmail) {
  const profileSpecialtiesGroup = document.getElementById('profileSpecialtiesGroup');
  const profileSpecialtiesContainer = document.getElementById('profileSpecialtiesContainer');
  
  if (!profileSpecialtiesGroup || !profileSpecialtiesContainer) return;
  
  profileSpecialtiesGroup.style.display = 'block';
  profileSpecialtiesContainer.innerHTML = '<p class="text-muted mb-0">Loading specialties...</p>';
  
  try {
    // Fetch all available specialties
    const allSpecialtiesResponse = await fetch(`${API_BASE_URL}/trainer/all-specialties`);
    if (!allSpecialtiesResponse.ok) {
      const errorText = await allSpecialtiesResponse.text();
      let errorMessage = 'Failed to fetch all specialties';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = `HTTP ${allSpecialtiesResponse.status}: ${errorText || allSpecialtiesResponse.statusText}`;
      }
      throw new Error(errorMessage);
    }
    const allSpecialtiesData = await allSpecialtiesResponse.json();
    if (!allSpecialtiesData.success) {
      throw new Error(allSpecialtiesData.message || 'Failed to load specialties');
    }
    const allSpecialties = allSpecialtiesData.data || [];
    
    // Fetch trainer's current specialties (this is optional - if it fails, we just won't pre-check any)
    let trainerSpecialtyIds = [];
    try {
      const trainerSpecialtiesResponse = await fetch(`${API_BASE_URL}/trainer/specialties?email=${encodeURIComponent(userEmail)}`);
      if (trainerSpecialtiesResponse.ok) {
        const trainerSpecialtiesData = await trainerSpecialtiesResponse.json();
        if (trainerSpecialtiesData.success) {
          trainerSpecialtyIds = trainerSpecialtiesData.data.map(s => s.specialtyId);
        }
      }
    } catch (error) {
      // If fetching trainer specialties fails, just continue without pre-checking
      console.warn('Could not load trainer specialties:', error);
    }
    
    // Build checkboxes
    if (allSpecialties.length === 0) {
      profileSpecialtiesContainer.innerHTML = '<p class="text-muted mb-0">No specialties available.</p>';
      return;
    }
    
    profileSpecialtiesContainer.innerHTML = '';
    allSpecialties.forEach(specialty => {
      const isChecked = trainerSpecialtyIds.includes(specialty.specialtyId);
      const checkboxDiv = document.createElement('div');
      checkboxDiv.className = 'form-check mb-2';
      checkboxDiv.innerHTML = `
        <input class="form-check-input" type="checkbox" value="${specialty.specialtyId}" id="specialty_${specialty.specialtyId}" ${isChecked ? 'checked' : ''} disabled>
        <label class="form-check-label text-white" for="specialty_${specialty.specialtyId}">
          ${specialty.specialtyName}
        </label>
      `;
      profileSpecialtiesContainer.appendChild(checkboxDiv);
    });
  } catch (error) {
    console.error('Error loading specialties:', error);
    profileSpecialtiesContainer.innerHTML = '<p class="text-danger mb-0">Error loading specialties. Please try again.</p>';
  }
}

/**
 * Update trainer specialties
 */
async function updateTrainerSpecialties(userEmail, specialtyIds) {
  try {
    const response = await fetch(`${API_BASE_URL}/trainer/specialties?email=${encodeURIComponent(userEmail)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ specialtyIds }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update specialties');
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to update specialties');
    }
  } catch (error) {
    console.error('Error updating specialties:', error);
    alert('Profile updated, but there was an error updating specialties: ' + error.message);
  }
}

/**
 * Show success modal with message
 */
function showSuccessModal(message) {
  const successModal = document.getElementById('successModal');
  const successModalMessage = document.getElementById('successModalMessage');
  
  if (successModal && successModalMessage) {
    successModalMessage.textContent = message;
    const modal = new bootstrap.Modal(successModal);
    modal.show();
  } else {
    // Fallback to alert if modal doesn't exist
    alert(message);
  }
}

/**
 * Handle logout
 */
function handleLogout() {
  // Show confirmation popup
  if (!confirm('Are you sure you want to logout?')) {
    return; // User clicked Cancel, do nothing
  }
  
  // Clear authentication state
  localStorage.clear();
  sessionStorage.clear();
  
  // Redirect to home page
  window.location.href = './index.html';
}

// Make functions globally available
window.handleProfileSubmit = handleProfileSubmit;
window.handleDeleteAccount = handleDeleteAccount;
window.handleLogout = handleLogout;
window.switchToEditMode = switchToEditMode;
window.switchToReadOnlyMode = switchToReadOnlyMode;


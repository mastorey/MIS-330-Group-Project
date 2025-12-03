// Trainer Sign Up Form Validation and Submission

const API_BASE_URL = 'http://localhost:5176/api';

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('signupForm');
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const phone = document.getElementById('phone');

  // Load specialties on page load
  loadSpecialties();

  // Format phone number as user types
  phone.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length > 0) {
      if (value.length <= 3) {
        value = value;
      } else if (value.length <= 6) {
        value = value.slice(0, 3) + '-' + value.slice(3);
      } else {
        value = value.slice(0, 3) + '-' + value.slice(3, 6) + '-' + value.slice(6, 10);
      }
    }
    e.target.value = value;
  });

  // Real-time password matching validation
  confirmPassword.addEventListener('input', function() {
    if (confirmPassword.value !== '') {
      if (password.value !== confirmPassword.value) {
        confirmPassword.setCustomValidity('Passwords do not match.');
        confirmPassword.classList.add('is-invalid');
      } else {
        confirmPassword.setCustomValidity('');
        confirmPassword.classList.remove('is-invalid');
        confirmPassword.classList.add('is-valid');
      }
    }
  });

  password.addEventListener('input', function() {
    if (confirmPassword.value !== '') {
      if (password.value !== confirmPassword.value) {
        confirmPassword.setCustomValidity('Passwords do not match.');
        confirmPassword.classList.add('is-invalid');
        confirmPassword.classList.remove('is-valid');
      } else {
        confirmPassword.setCustomValidity('');
        confirmPassword.classList.remove('is-invalid');
        confirmPassword.classList.add('is-valid');
      }
    }
  });

  // Age validation function
  function isAtLeast18(birthday) {
    if (!birthday) return false;
    // Parse date string manually in local timezone to avoid UTC conversion issues
    const [y, m, d] = birthday.split('-');
    const birthDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  }

  // Birthday validation
  const birthdayInput = document.getElementById('birthday');
  const birthdayFeedback = birthdayInput.nextElementSibling;
  
  birthdayInput.addEventListener('change', function() {
    if (birthdayInput.value) {
      if (!isAtLeast18(birthdayInput.value)) {
        birthdayInput.setCustomValidity('You must be 18 years or older to make an account.');
        birthdayInput.classList.add('is-invalid');
        birthdayInput.classList.remove('is-valid');
        birthdayFeedback.textContent = 'You must be 18 years or older to make an account.';
      } else {
        birthdayInput.setCustomValidity('');
        birthdayInput.classList.remove('is-invalid');
        birthdayInput.classList.add('is-valid');
      }
    } else {
      birthdayInput.setCustomValidity('');
      birthdayInput.classList.remove('is-invalid', 'is-valid');
      birthdayFeedback.textContent = 'Please provide your birthday.';
    }
  });

  // Form submission handler
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    event.stopPropagation();

    // Check if passwords match
    if (password.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity('Passwords do not match.');
      confirmPassword.classList.add('is-invalid');
    } else {
      confirmPassword.setCustomValidity('');
    }

    // Check age requirement (only if birthday is provided)
    if (birthdayInput.value && !isAtLeast18(birthdayInput.value)) {
      birthdayInput.setCustomValidity('You must be 18 years or older to make an account.');
      birthdayFeedback.textContent = 'You must be 18 years or older to make an account.';
      birthdayInput.classList.add('is-invalid');
      form.classList.add('was-validated');
      return;
    } else {
      birthdayInput.setCustomValidity('');
    }

    // Check form validity
    if (!form.checkValidity()) {
      event.preventDefault();
      event.stopPropagation();
      form.classList.add('was-validated');
      return;
    }

    // Validate rate field
    const rateInput = document.getElementById('rate');
    const rateValue = parseFloat(rateInput.value);
    if (isNaN(rateValue) || rateValue < 0) {
      rateInput.setCustomValidity('Please provide a valid rate (must be 0 or greater).');
      rateInput.classList.add('is-invalid');
      form.classList.add('was-validated');
      return;
    } else {
      rateInput.setCustomValidity('');
      rateInput.classList.remove('is-invalid');
    }

    // Validate specialties - at least one must be selected
    const specialtyCheckboxes = document.querySelectorAll('#specialtiesContainer input[type="checkbox"]:checked');
    const specialtiesContainer = document.getElementById('specialtiesContainer');
    const specialtiesFeedback = document.getElementById('specialtiesFeedback');
    
    if (specialtyCheckboxes.length === 0) {
      if (specialtiesContainer) specialtiesContainer.classList.add('border-danger');
      if (specialtiesFeedback) specialtiesFeedback.style.display = 'block';
      form.classList.add('was-validated');
      return;
    } else {
      if (specialtiesContainer) specialtiesContainer.classList.remove('border-danger');
      if (specialtiesFeedback) specialtiesFeedback.style.display = 'none';
    }

    // Collect selected specialty IDs
    const specialtyIds = Array.from(specialtyCheckboxes).map(cb => parseInt(cb.value));

    // If form is valid, prepare data for submission
    const formData = {
      FirstName: document.getElementById('firstName').value.trim(),
      LastName: document.getElementById('lastName').value.trim(),
      Email: document.getElementById('email').value.trim().toLowerCase(),
      Phone: document.getElementById('phone').value.trim(), // Store with dashes (123-456-7890)
      Birthday: document.getElementById('birthday').value,
      Password: password.value,
      Rate: rateValue,
      Certification: document.getElementById('certification').value.trim() || null,
      SpecialtyIds: specialtyIds,
      UserType: 'trainer' // Will be normalized to "Trainer" on backend
    };

    // TODO: Replace with actual API call
    console.log('Trainer form data to be submitted:', formData);
    
    // Mock submission - replace with actual API call
    submitForm(formData);
  });

  // Add validation styling on blur
  const inputs = form.querySelectorAll('input[required]');
  inputs.forEach(input => {
    input.addEventListener('blur', function() {
      if (input.checkValidity()) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
      } else {
        input.classList.remove('is-valid');
        input.classList.add('is-invalid');
      }
    });
  });
});

// Form submission function
async function submitForm(formData) {
  const errorMessage = document.getElementById('errorMessage') || createErrorMessageElement();
  
  try {
    const response = await fetch('http://localhost:5176/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      errorMessage.className = 'alert alert-success';
      errorMessage.textContent = data.message || 'Trainer account created successfully! Redirecting to login...';
      errorMessage.classList.remove('d-none');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = './login.html';
      }, 2000);
    } else {
      errorMessage.className = 'alert alert-danger';
      errorMessage.textContent = data.message || 'Account creation failed. Please try again.';
      errorMessage.classList.remove('d-none');
    }
  } catch (error) {
    console.error('Error submitting form:', error);
    errorMessage.className = 'alert alert-danger';
    errorMessage.textContent = 'An error occurred. Please try again.';
    errorMessage.classList.remove('d-none');
  }
}

function createErrorMessageElement() {
  const form = document.getElementById('signupForm');
  const errorDiv = document.createElement('div');
  errorDiv.id = 'errorMessage';
  errorDiv.className = 'alert d-none';
  errorDiv.setAttribute('role', 'alert');
  form.insertBefore(errorDiv, form.querySelector('.d-grid'));
  return errorDiv;
}

/**
 * Load all available specialties and populate checkboxes
 */
async function loadSpecialties() {
  const specialtiesContainer = document.getElementById('specialtiesContainer');
  if (!specialtiesContainer) return;

  try {
    const response = await fetch(`${API_BASE_URL}/trainer/all-specialties`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch specialties');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to load specialties');
    }
    
    const specialties = data.data || [];
    
    if (specialties.length === 0) {
      specialtiesContainer.innerHTML = '<p class="text-danger mb-0">No specialties available. Please contact support.</p>';
      return;
    }
    
    // Clear loading message
    specialtiesContainer.innerHTML = '';
    
    // Create checkboxes for each specialty
    specialties.forEach(specialty => {
      const checkboxDiv = document.createElement('div');
      checkboxDiv.className = 'form-check mb-2';
      checkboxDiv.innerHTML = `
        <input class="form-check-input" type="checkbox" value="${specialty.specialtyId}" id="specialty_${specialty.specialtyId}">
        <label class="form-check-label" for="specialty_${specialty.specialtyId}">
          ${specialty.specialtyName}
        </label>
      `;
      specialtiesContainer.appendChild(checkboxDiv);
    });
  } catch (error) {
    console.error('Error loading specialties:', error);
    specialtiesContainer.innerHTML = '<p class="text-danger mb-0">Error loading specialties. Please refresh the page.</p>';
  }
}


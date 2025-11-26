// Trainer Sign Up Form Validation and Submission

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('signupForm');
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const phone = document.getElementById('phone');

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

    // Check form validity
    if (!form.checkValidity()) {
      event.preventDefault();
      event.stopPropagation();
      form.classList.add('was-validated');
      return;
    }

    // If form is valid, prepare data for submission
    const formData = {
      FirstName: document.getElementById('firstName').value.trim(),
      LastName: document.getElementById('lastName').value.trim(),
      Email: document.getElementById('email').value.trim().toLowerCase(),
      Phone: document.getElementById('phone').value.trim(), // Store with dashes (123-456-7890)
      Birthday: document.getElementById('birthday').value,
      Password: password.value,
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


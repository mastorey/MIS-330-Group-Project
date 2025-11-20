// Sign Up Form Validation and Submission

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
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim().toLowerCase(),
      phone: document.getElementById('phone').value.replace(/\D/g, ''), // Store as digits only
      birthday: document.getElementById('birthday').value,
      password: password.value,
      userType: 'client' // Distinguish client from trainer
    };

    // TODO: Replace with actual API call
    console.log('Form data to be submitted:', formData);
    
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

// Placeholder function for form submission
async function submitForm(formData) {
  try {
    // TODO: Replace with actual API endpoint
    // const response = await fetch('/api/auth/signup', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(formData)
    // });
    
    // if (response.ok) {
    //   const data = await response.json();
    //   // Redirect to login or dashboard
    //   window.location.href = '/login';
    // } else {
    //   const error = await response.json();
    //   alert('Error: ' + error.message);
    // }

    // Mock success for now
    alert('Account creation successful! (This is a placeholder - connect to API)');
    console.log('Would submit to API:', formData);
  } catch (error) {
    console.error('Error submitting form:', error);
    alert('An error occurred. Please try again.');
  }
}


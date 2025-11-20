// Admin Login Form Validation

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('adminLoginForm');
  const adminCode = document.getElementById('adminCode');
  const CORRECT_CODE = '12345';

  // Form submission handler
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    event.stopPropagation();

    const enteredCode = adminCode.value.trim();

    // Validate code
    if (enteredCode === '') {
      adminCode.classList.add('is-invalid');
      adminCode.classList.remove('is-valid');
      form.classList.add('was-validated');
      return;
    }

    if (enteredCode === CORRECT_CODE) {
      // Code is correct
      adminCode.classList.remove('is-invalid');
      adminCode.classList.add('is-valid');
      
      // TODO: Replace with actual API call and redirect
      // For now, show success message and redirect to admin page
      console.log('Admin code verified. Redirecting to admin portal...');
      
      // Mock redirect - replace with actual admin dashboard URL
      setTimeout(function() {
        // window.location.href = '/admin/dashboard';
        alert('Admin code accepted! (Redirect to admin dashboard - connect to API)');
      }, 500);
    } else {
      // Code is incorrect
      adminCode.classList.remove('is-valid');
      adminCode.classList.add('is-invalid');
      adminCode.value = '';
      form.classList.add('was-validated');
    }
  });

  // Clear validation on input
  adminCode.addEventListener('input', function() {
    if (adminCode.classList.contains('is-invalid')) {
      adminCode.classList.remove('is-invalid');
    }
    if (adminCode.classList.contains('is-valid')) {
      adminCode.classList.remove('is-valid');
    }
  });
});


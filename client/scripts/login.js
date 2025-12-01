// Login form handling with database authentication

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Hide error message
    errorMessage.classList.add('d-none');

    // Validate form
    if (!loginForm.checkValidity()) {
      loginForm.classList.add('was-validated');
      return;
    }

    // Get form data
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      // Call API to authenticate user
      const response = await fetch('http://localhost:5176/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Authentication failed
        throw new Error(data.message || 'Login failed. Please check your credentials and try again.');
      }

      // Login successful - show success message with role
      const role = data.role || 'user';
      const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
      const userName = data.firstName ? `${data.firstName} ${data.lastName}`.trim() : email;
      
      // Store authentication state in localStorage (persists across page refreshes)
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', role);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('userFirstName', data.firstName || '');
      localStorage.setItem('userLastName', data.lastName || '');
      
      // Display success message
      errorMessage.className = 'alert alert-success';
      errorMessage.textContent = `Successfully logged in as a ${roleDisplay}. Welcome, ${userName}!`;
      errorMessage.classList.remove('d-none');

      // Clear form
      loginForm.reset();
      loginForm.classList.remove('was-validated');

      // Redirect based on role (navbar will update automatically on new page load)
      setTimeout(() => {
        if (role.toLowerCase() === 'trainer') {
          window.location.href = './trainer.html';
        } else if (role.toLowerCase() === 'client') {
          window.location.href = './client.html';
        } else if (role.toLowerCase() === 'admin') {
          window.location.href = './index.html';
        } else {
          window.location.href = './index.html';
        }
      }, 1500);

    } catch (error) {
      // Display error message
      errorMessage.className = 'alert alert-danger';
      errorMessage.textContent = error.message || 'Login failed. Please check your credentials and try again.';
      errorMessage.classList.remove('d-none');
    }
  });
});


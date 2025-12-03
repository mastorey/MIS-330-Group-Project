// Main JavaScript for MIS 330 Project

// Global state management
window.appState = {
  // Add your application state here
};

// Show loader until page is ready
window.addEventListener('load', function () {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    // Small timeout so the loader is visible briefly even on fast loads
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 300);
  }

  initializeApp();
});

function initializeApp() {
  console.log('Application initialized');
  // Add your initialization code here
}


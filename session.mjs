async function checkSession() {
    try {
      const response = await fetch('/api/sessionStatus');
      const data = await response.json();
  
      if (data.isAuthenticated) {
        console.log('User is logged in');
        // Update UI for logged-in user
      } else {
        console.log('User is not logged in');
        // Redirect to login page or show login prompt
      }
    } catch (error) {
      console.error('Error checking session:', error);
      // Handle error (e.g., display error message)
    }
  }
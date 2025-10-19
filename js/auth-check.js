// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('authToken');
    const currentUser = localStorage.getItem('currentUser');
    
    if (!token || !currentUser) {
        // Not logged in - redirect to landing page
        window.location.href = 'landing.html';
        return false;
    }
    
    return true;
}

// Check authentication on page load
if (!checkAuth()) {
    // Will redirect if not authenticated
}


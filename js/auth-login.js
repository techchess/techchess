// Login functionality with Node.js backend
// API_URL is now defined in config.js

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    successMessage.classList.remove('show');
}

// Show success message
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.classList.add('show');
    errorMessage.classList.remove('show');
}

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameOrEmail = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!usernameOrEmail || !password) {
        showError('Please fill in all fields');
        return;
    }

    // Disable button and show loading
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    errorMessage.classList.remove('show');
    successMessage.classList.remove('show');

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernameOrEmail, password })
        });

        const data = await response.json();

        if (!response.ok) {
            // Check if needs verification
            if (data.needsVerification) {
                showError(data.error + '. Please check your email and verify your account first.');
            } else {
                throw new Error(data.error || 'Login failed');
            }
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
            return;
        }

        // Successful login
        showSuccess('Login successful! Redirecting...');
        
        // Store auth token and user info in localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));

        // Redirect to main game
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);

    } catch (error) {
        showError(error.message);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
});


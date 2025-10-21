// Signup functionality with Node.js backend
// API_URL is now defined in config.js

const signupForm = document.getElementById('signup-form');
const signupBtn = document.getElementById('signup-btn');
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

// Show verification code input
function showVerificationInput(username, verificationCode) {
    signupForm.innerHTML = `
        <div style="background: rgba(40, 167, 69, 0.2); border: 2px solid #28a745; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; text-align: center;">
            <p style="color: #ccffcc; margin-bottom: 0.5rem; font-size: 0.9rem;">Your Verification Code:</p>
            <h2 style="color: #4a8f5a; font-size: 2.5rem; letter-spacing: 8px; margin: 0;">${verificationCode}</h2>
        </div>
        <div class="form-group">
            <label for="verification-code">Enter Code</label>
            <input type="text" id="verification-code" maxlength="6" 
                   placeholder="Enter the code above" required autocomplete="off">
        </div>
        <div id="error-message" class="error-message"></div>
        <div id="success-message" class="success-message"></div>
        <button type="submit" class="auth-button" id="verify-btn">
            Verify Account
        </button>
    `;

    // Handle verification
    const verifyBtn = document.getElementById('verify-btn');
    const verificationCodeInput = document.getElementById('verification-code');
    const newErrorMessage = document.getElementById('error-message');
    const newSuccessMessage = document.getElementById('success-message');

    signupForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const code = verificationCodeInput.value.trim();
        if (code.length !== 6) {
            newErrorMessage.textContent = 'Please enter the 6-digit code';
            newErrorMessage.classList.add('show');
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            const response = await fetch(`${API_URL}/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, code })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Verification failed');
            }

            newSuccessMessage.textContent = 'Email verified! Redirecting to login...';
            newSuccessMessage.classList.add('show');
            newErrorMessage.classList.remove('show');

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            newErrorMessage.textContent = error.message;
            newErrorMessage.classList.add('show');
            newSuccessMessage.classList.remove('show');
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify Email';
        }
    };
}

// Handle signup form submission
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('🔥 SIGNUP FORM SUBMITTED!');

    // Check if we're on the signup form or verification form
    const usernameInput = document.getElementById('username');
    if (!usernameInput) {
        // We're on the verification screen, let the verification handler deal with it
        return;
    }

    const username = usernameInput.value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    console.log('📝 Form data:', { username, password: '***' });

    // Validate inputs (simplified - no email validation)
    if (username.length < 3) {
        showError('Username must be at least 3 characters long');
        return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        showError('Username can only contain letters, numbers, underscores, and hyphens');
        return;
    }

    if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }

    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }

    // Disable button and show loading
    signupBtn.disabled = true;
    signupBtn.textContent = 'Creating Account...';
    errorMessage.classList.remove('show');
    successMessage.classList.remove('show');

    try {
        console.log('🌐 Sending request to:', `${API_URL}/signup`);
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        console.log('✅ Got response:', response.status);
        const data = await response.json();
        console.log('📦 Response data:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }

        // Show verification input immediately with code displayed
        showVerificationInput(username, data.verificationCode);

    } catch (error) {
        showError(error.message);
        signupBtn.disabled = false;
        signupBtn.textContent = 'Sign Up';
    }
});


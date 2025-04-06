function togglePassword(fieldId) {
    const passwordField = document.getElementById(fieldId);
    const eyeIcon = passwordField.nextElementSibling;

    if (passwordField.type === "password") {
        passwordField.type = "text";
        eyeIcon.textContent = "🙈";
    } else {
        passwordField.type = "password";
        eyeIcon.textContent = "👁️";
    }
}

function openModal() {
    document.getElementById("forgotPasswordModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("forgotPasswordModal").style.display = "none";
    document.getElementById("reset-error-message").textContent = "";
    document.getElementById("reset-success-message").textContent = "";
    document.getElementById("reset-success-message").style.display = "none";
}

function guestLogin() {
    // Set guest mode flag
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem('userId', 'guest');
    window.location.href = "../HOME/home.html";
}

// For testing only - remove in production
function createTestUser() {
    if (!window.testUserCreated) {
        const mockUsers = [
            {
                userId: "test",
                name: "Test User",
                email: "test@example.com",
                password: "test123",
                role: "user"
            }
        ];
        localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
        window.testUserCreated = true;
        console.log('Test user created for offline mode');
    }
}

// Uncomment to enable test user
// createTestUser();

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("userId").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");

    errorMessage.textContent = "";
    successMessage.textContent = "";
    successMessage.style.display = "none";

    // Show loading indicator
    errorMessage.textContent = "Logging in...";

    // Check for offline/demo mode
    const mockUsers = JSON.parse(localStorage.getItem('mockUsers') || '[]');
    const mockUser = mockUsers.find(u => u.userId === userId && u.password === password);
    
    if (mockUser) {
        // Mock successful login
        successMessage.textContent = "Login successful! Redirecting...";
        successMessage.style.display = "block";
        errorMessage.textContent = "";
        
        localStorage.setItem('userId', userId);
        localStorage.setItem('userName', mockUser.name);
        localStorage.setItem('userRole', mockUser.role);
        localStorage.setItem('offlineMode', 'true');
        
        setTimeout(() => {
            window.location.href = "../HOME/home.html";
        }, 1000);
        return;
    }

    try {
        // For Vercel deployment
        const API_BASE_URL = 'https://icb-tracking-website.vercel.app';
        
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                password
            })
        });

        // Clear loading indicator
        errorMessage.textContent = "";

        // Special case for 401 errors - offer guest mode
        if (response.status === 401) {
            errorMessage.innerHTML = "Login failed: Invalid credentials.<br>You can <a href='#' onclick='guestLogin()'>continue as guest</a> or use the demo account: test/test123";
            return;
        }

        try {
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `Login failed (${response.status})`);
            }

            successMessage.textContent = "Login successful! Redirecting...";
            successMessage.style.display = "block";
            
            // Store user ID for later use
            localStorage.setItem('userId', userId);
            localStorage.setItem('offlineMode', 'false');
            
            // Redirect to welcome page after 1 second
            setTimeout(() => {
                window.location.href = "../HOME/home.html";
            }, 1000);
        } catch (jsonError) {
            // Handle case where response is not valid JSON
            throw new Error(`Server response error: ${response.status}`);
        }
    } catch (error) {
        console.error("Login error:", error);
        errorMessage.innerHTML = error.message + "<br>You can <a href='#' onclick='guestLogin()'>continue as guest</a> instead.";
    }
});

document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("resetUserId").value;
    const newPassword = document.getElementById("resetNewPassword").value;
    const confirmPassword = document.getElementById("resetConfirmPassword").value;
    const errorMessage = document.getElementById("reset-error-message");
    const successMessage = document.getElementById("reset-success-message");

    errorMessage.textContent = "";
    successMessage.textContent = "";
    successMessage.style.display = "none";

    if (newPassword !== confirmPassword) {
        errorMessage.textContent = "Passwords do not match!";
        return;
    }

    try {
        // For Vercel deployment
        const API_BASE_URL = 'https://icb-tracking-website.vercel.app';
        
        const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                newPassword
            })
        });

        try {
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }

            successMessage.textContent = "Password reset successfully!";
            successMessage.style.display = "block";
            
            // Clear form and close modal after 2 seconds
            setTimeout(() => {
                document.getElementById("resetPasswordForm").reset();
                closeModal();
            }, 2000);
        } catch (jsonError) {
            throw new Error(`Server response error: ${response.status}`);
        }
    } catch (error) {
        console.error("Reset password error:", error);
        errorMessage.textContent = error.message;
    }
});

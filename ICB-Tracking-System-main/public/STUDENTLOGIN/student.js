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

// API Configuration
const API_BASE_URL = 'https://icb-tracking-website.vercel.app';
const LOGIN_ENDPOINT = '/api/login';
const RESET_ENDPOINT = '/api/reset-password';
const REGISTER_ENDPOINT = '/api/register'; 
const STATUS_ENDPOINT = '/api/status';

// Default test user for development
const TEST_USER = {
    userId: "test123",
    name: "Test User",
    email: "test@example.com",
    password: "test123",
    role: "user"
};

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
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem('userId', 'guest');
    localStorage.setItem('userName', 'Guest User');
    localStorage.setItem('userRole', 'guest');
    
    window.location.href = "../HOME/home.html";
}

// Create test user function
async function createTestUser() {
    try {
        const response = await fetch(`${API_BASE_URL}${REGISTER_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(TEST_USER),
            credentials: 'include'
        });
        
        const data = await response.json();
        console.log("Test user creation result:", data);
        
        // If user already exists, that's fine too
        return true;
    } catch (error) {
        console.error("Error creating test user:", error);
        return false;
    }
}

// Check server and DB status
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}${STATUS_ENDPOINT}`);
        if (response.ok) {
            const data = await response.json();
            console.log("Server status:", data);
            return data.dbConnected;
        }
        return false;
    } catch (error) {
        console.error("Error checking server status:", error);
        return false;
    }
}

// Check if user was just registered and populate the userId field
document.addEventListener('DOMContentLoaded', async function() {
    const registeredUserId = localStorage.getItem('registeredUserId');
    if (registeredUserId) {
        document.getElementById("userId").value = registeredUserId;
        localStorage.removeItem('registeredUserId'); // Clear it after use
    }
    
    // Check server status and create test user if needed
    const isDbConnected = await checkServerStatus();
    if (!isDbConnected) {
        console.log("Database not connected. Test user may be needed.");
        await createTestUser();
        
        // Add test user credentials hint
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            const helpText = document.createElement('p');
            helpText.innerHTML = `<small>Try test credentials: <br>ID: ${TEST_USER.userId}, Password: ${TEST_USER.password}</small>`;
            helpText.style.color = '#666';
            helpText.style.fontSize = '12px';
            loginForm.appendChild(helpText);
        }
    }
});

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("userId").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");
    const submitButton = this.querySelector('button[type="submit"]');

    // Clear previous messages
    errorMessage.textContent = "";
    successMessage.textContent = "";
    successMessage.style.display = "none";
    
    // Validate input
    if (!userId || !password) {
        errorMessage.textContent = "Please enter both user ID and password";
        return;
    }
    
    // Show loading message and disable button
    errorMessage.textContent = "Authenticating...";
    if (submitButton) submitButton.disabled = true;
    
    try {
        // First check if we should try with test user credentials
        const isTestUser = userId === TEST_USER.userId && password === TEST_USER.password;
        
        // Create test user if the credentials match but we haven't registered it yet
        if (isTestUser) {
            await createTestUser();
        }
        
        const apiUrl = `${API_BASE_URL}${LOGIN_ENDPOINT}`;
        console.log(`Authenticating with: ${apiUrl}`);
        
        // Use retry mechanism for auth
        const maxRetries = 2;
        let retryCount = 0;
        let success = false;
        
        while (retryCount <= maxRetries && !success) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000);
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: userId.trim(),
                        password: password
                    }),
                    credentials: 'include',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                console.log("Login response status:", response.status);
                
                // Parse response
                let data;
                try {
                    data = await response.json();
                    console.log("Login response data:", data);
                } catch (jsonError) {
                    throw new Error("Unable to parse server response. Please try again.");
                }
                
                // Handle 401 unauthorized errors
                if (response.status === 401) {
                    // If this is the test user and we got 401, maybe the server restarted
                    // and lost the in-memory data. Try re-creating the test user.
                    if (isTestUser && retryCount === 0) {
                        console.log("Trying to recreate test user...");
                        await createTestUser();
                        retryCount++;
                        continue;
                    }
                    
                    errorMessage.textContent = "Invalid username or password. Please try again.";
                    if (submitButton) submitButton.disabled = false;
                    return;
                }
                
                if (!response.ok) {
                    throw new Error(data.message || `Server error (${response.status})`);
                }
                
                success = true;
                
                // Update auth status
                if (data && data.data && data.data.user) {
                    // Save user info to localStorage for persistence
                    localStorage.setItem('userData', JSON.stringify(data.data.user));
                    localStorage.setItem('userId', data.data.user.userId);
                    localStorage.setItem('userRole', data.data.user.role || 'user');
                    localStorage.setItem('userName', data.data.user.name);
                    localStorage.setItem('dbConnected', 'true');
                    
                    console.log("User authenticated successfully:", data.data.user.userId);
                } else {
                    localStorage.setItem('userId', userId);
                    localStorage.setItem('userName', 'User');
                }
                
                // Show success and redirect
                errorMessage.textContent = "";
                successMessage.textContent = "Login successful! Redirecting...";
                successMessage.style.display = "block";
                
                setTimeout(() => {
                    window.location.href = "../HOME/home.html";
                }, 1000);
            } catch (fetchError) {
                retryCount++;
                
                if (fetchError.name === 'AbortError') {
                    console.log("Request timed out, retrying...");
                } else if (retryCount > maxRetries) {
                    throw fetchError;
                }
                
                console.log(`Retrying authentication (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        if (!success) {
            throw new Error("Authentication failed after multiple attempts");
        }
    } catch (error) {
        console.error("Login error:", error);
        errorMessage.textContent = error.message || "Login failed. Please try again.";
        
        // Add guest mode option if authentication fails
        errorMessage.innerHTML += ` <a href='#' onclick='guestLogin()'>Continue as guest</a>`;
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("resetUserId").value;
    const newPassword = document.getElementById("resetNewPassword").value;
    const confirmPassword = document.getElementById("resetConfirmPassword").value;
    const errorMessage = document.getElementById("reset-error-message");
    const successMessage = document.getElementById("reset-success-message");
    const resetSubmitButton = this.querySelector('button[type="submit"]');

    errorMessage.textContent = "";
    successMessage.textContent = "";
    successMessage.style.display = "none";

    // Validate input
    if (!userId) {
        errorMessage.textContent = "Please enter your User ID";
        return;
    }
    
    if (!newPassword || !confirmPassword) {
        errorMessage.textContent = "Please enter both password fields";
        return;
    }

    if (newPassword !== confirmPassword) {
        errorMessage.textContent = "Passwords do not match!";
        return;
    }
    
    // Show loading message and disable button
    errorMessage.textContent = "Processing request...";
    if (resetSubmitButton) resetSubmitButton.disabled = true;

    try {
        const apiUrl = `${API_BASE_URL}${RESET_ENDPOINT}`;
        console.log(`Resetting password at: ${apiUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased timeout
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId.trim(),
                    newPassword: newPassword
                }),
                credentials: 'include',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            console.log("Password reset response status:", response.status);
            
            let data;
            try {
                data = await response.json();
                console.log("Password reset response data:", data);
            } catch (jsonError) {
                throw new Error("Unable to parse server response");
            }
            
            if (response.status === 404) {
                errorMessage.textContent = "User not found. Please check your User ID.";
                if (resetSubmitButton) resetSubmitButton.disabled = false;
                return;
            }
            
            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }
            
            // Clear form and error message
            errorMessage.textContent = "";
            document.getElementById("resetPasswordForm").reset();
            
            // Show success message
            successMessage.textContent = "Password reset successfully!";
            successMessage.style.display = "block";
            
            setTimeout(() => {
                closeModal();
            }, 2000);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            if (fetchError.name === 'AbortError') {
                throw new Error("Request timed out. Server may be unavailable.");
            }
            
            throw fetchError;
        }
    } catch (error) {
        console.error("Reset password error:", error);
        errorMessage.textContent = error.message || "Password reset failed. Please try again.";
    } finally {
        if (resetSubmitButton) resetSubmitButton.disabled = false;
    }
});

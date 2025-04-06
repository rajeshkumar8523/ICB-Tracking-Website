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
const DB_URI = 'mongodb+srv://rajesh:rajesh@cluster0.cqkgbx3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

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
    
    window.location.href = "../HOME/home.html";
}

// Check if user was just registered and populate the userId field
document.addEventListener('DOMContentLoaded', function() {
    const registeredUserId = localStorage.getItem('registeredUserId');
    if (registeredUserId) {
        document.getElementById("userId").value = registeredUserId;
        localStorage.removeItem('registeredUserId'); // Clear it after use
    }
});

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("userId").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");
    const loginButton = document.getElementById("loginButton");

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
    loginButton.disabled = true;
    
    try {
        const apiUrl = `${API_BASE_URL}${LOGIN_ENDPOINT}`;
        console.log(`Authenticating with: ${apiUrl}`);
        console.log(`DB URI being used: ${DB_URI}`);
        
        // Use retry mechanism for auth
        const maxRetries = 2;
        let retryCount = 0;
        let success = false;
        let finalResponse = null;
        let finalData = null;
        
        while (retryCount <= maxRetries && !success) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased timeout to 20s
                
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
                finalResponse = response;
                console.log("Login response status:", response.status);
                
                // Parse response
                let data;
                try {
                    data = await response.json();
                    finalData = data;
                    console.log("Login response data:", data);
                } catch (jsonError) {
                    console.error("Error parsing response:", jsonError);
                    throw new Error("Unable to parse server response. Please try again.");
                }
                
                // Check if registered but failed login - no need to retry
                if (response.status === 401) {
                    errorMessage.textContent = "Invalid username or password. Please try again.";
                    loginButton.disabled = false;
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
                }
                
                // Show success and redirect
                errorMessage.textContent = "";
                successMessage.textContent = "Login successful! User data fetched from MongoDB. Redirecting...";
                successMessage.style.display = "block";
                
                setTimeout(() => {
                    window.location.href = "../HOME/home.html";
                }, 1000);
            } catch (fetchError) {
                retryCount++;
                
                if (fetchError.name === 'AbortError') {
                    console.log("Request timed out, retrying...");
                    // Continue retry loop on timeout
                } else if (retryCount > maxRetries) {
                    throw fetchError;
                }
                
                console.log(`Retrying authentication (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
        
        if (!success) {
            if (finalResponse && finalResponse.status === 401) {
                errorMessage.textContent = "Invalid username or password. Please try again.";
            } else if (finalData && finalData.message) {
                throw new Error(finalData.message);
            } else {
                throw new Error("Authentication failed after multiple attempts");
            }
        }
    } catch (error) {
        console.error("Login error:", error);
        errorMessage.textContent = error.message || "Login failed. Please try again.";
        
        // Add guest mode option if authentication fails
        errorMessage.innerHTML += ` <a href='#' onclick='guestLogin()'>Continue as guest</a>`;
    } finally {
        loginButton.disabled = false;
    }
});

document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("resetUserId").value;
    const newPassword = document.getElementById("resetNewPassword").value;
    const confirmPassword = document.getElementById("resetConfirmPassword").value;
    const errorMessage = document.getElementById("reset-error-message");
    const successMessage = document.getElementById("reset-success-message");
    const resetButton = document.getElementById("resetButton");

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
    resetButton.disabled = true;

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
                resetButton.disabled = false;
                return;
            }
            
            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }
            
            // Clear form and error message
            errorMessage.textContent = "";
            document.getElementById("resetPasswordForm").reset();
            
            // Show success message
            successMessage.textContent = "Password reset successfully in MongoDB database!";
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
        resetButton.disabled = false;
    }
});

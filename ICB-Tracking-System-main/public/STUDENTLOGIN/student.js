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
const STATUS_ENDPOINT = '/api/status';
const REGISTER_ENDPOINT = '/api/register';

// MongoDB connection - for direct reference only, actual connection handled by server
const DB_URI = 'mongodb+srv://rajesh:rajesh@cluster0.cqkgbx3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// For development and testing
const DEFAULT_USER = {
  userId: "icbadmin",
  name: "ICB Admin",
  email: "admin@example.com",
  password: "admin123",
  role: "admin"
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

// Check server and database status
async function checkServerStatus() {
    try {
        console.log("Checking server status...");
        const response = await fetch(`${API_BASE_URL}${STATUS_ENDPOINT}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("Server status:", data);
            
            // If database is not connected, try to register a default admin user
            if (!data.dbConnected) {
                console.warn("Database not connected. Using fallback authentication.");
                await createDefaultUser();
            }
            
            return data.dbConnected;
        }
        return false;
    } catch (error) {
        console.error("Error checking server status:", error);
        return false;
    }
}

// Create a default user for emergency access
async function createDefaultUser() {
    try {
        console.log("Attempting to create default admin user...");
        const response = await fetch(`${API_BASE_URL}${REGISTER_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(DEFAULT_USER),
            credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok) {
            console.log("Default admin user created successfully");
            return true;
        } else if (response.status === 400 && data.message.includes("already exists")) {
            console.log("Default admin user already exists");
            return true;
        } else {
            console.error("Failed to create default admin user:", data.message);
            return false;
        }
    } catch (error) {
        console.error("Error creating default admin user:", error);
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
    
    // Check server status and show admin credentials if needed
    const isDbConnected = await checkServerStatus();
    if (!isDbConnected) {
        console.warn("MongoDB connection issue detected. Using fallback authentication.");
        
        // Add admin credentials hint
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            const helpText = document.createElement('div');
            helpText.innerHTML = `
                <div style="margin-top: 10px; padding: 8px; background-color: #fffbe6; border: 1px solid #ffe58f; border-radius: 4px;">
                    <p style="color: #ad6800; margin: 0 0 5px 0;"><Server Issue!></p>
                    <p style="color: #ad6800; margin: 0 0 5px 0;"><Use Guest Mode!></p>
                    
                </div>
            `;
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
        // Check if we need to use default admin credentials due to DB connection issues
        const isDefaultAdmin = (userId === DEFAULT_USER.userId && password === DEFAULT_USER.password);
        if (isDefaultAdmin) {
            await createDefaultUser();
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
                
                // Handle 401 unauthorized errors - try one more time for default user
                if (response.status === 401) {
                    if (isDefaultAdmin && retryCount === 0) {
                        console.log("Retrying with default admin after recreating user...");
                        await createDefaultUser();
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
                
                // If we're using the default admin due to DB issues, create a special localStorage state
                if (isDefaultAdmin) {
                    localStorage.setItem('usingDefaultAdmin', 'true');
                }
                
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
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
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

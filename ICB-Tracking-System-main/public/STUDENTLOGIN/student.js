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
    // Set a flag to indicate guest mode
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem('userId', 'guest');
    window.location.href = "../HOME/home.html";
}

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("userId").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");

    // Clear previous messages
    errorMessage.textContent = "";
    successMessage.textContent = "";
    successMessage.style.display = "none";

    try {
        // Get API URL from config
        const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'https://icb-tracking-website.vercel.app';
        console.log("Attempting login with API:", API_BASE_URL);
        
        // Show loading message
        errorMessage.textContent = "Logging in...";
        
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

        // Clear loading message
        errorMessage.textContent = "";

        // Try to parse response as JSON
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error("JSON parse error:", jsonError);
            throw new Error("Server response error. Try again later.");
        }

        if (!response.ok) {
            throw new Error(data.message || 'Login failed: ' + response.status);
        }

        successMessage.textContent = "Login successful! Redirecting...";
        successMessage.style.display = "block";
        
        // Store user ID for later use
        localStorage.setItem('userId', userId);
        localStorage.setItem('guestMode', 'false');
        
        // Redirect to welcome page after 1 second
        setTimeout(() => {
            window.location.href = "../HOME/home.html";
        }, 1000);
    } catch (error) {
        console.error("Login error:", error);
        errorMessage.textContent = error.message || "Login failed. Please try again.";
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
        // Point directly to the production API
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
    } catch (error) {
        errorMessage.textContent = error.message;
    }
});

// Add a function to check API connectivity
document.addEventListener('DOMContentLoaded', async function() {
    const errorMessage = document.getElementById("error-message");
    try {
        const response = await fetch('https://icb-tracking-website.vercel.app/api/buses');
        if (response.ok) {
            console.log("API connection successful");
        } else {
            console.error("API responded with status:", response.status);
            errorMessage.textContent = "API connection issue. Status: " + response.status;
        }
    } catch (error) {
        console.error("API connection error:", error);
        errorMessage.textContent = "API connection failed. Check console for details.";
    }
});

// Debug utility function
function checkApiStatus() {
    const API_ENDPOINTS = [
        '/api/buses',
        '/api/login',
        '/api/reset-password'
    ];
    
    const errorMessage = document.getElementById("error-message");
    errorMessage.textContent = "Checking API connectivity...";
    
    const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'https://icb-tracking-website.vercel.app';
    
    // Create debug button
    const debugButton = document.createElement('button');
    debugButton.textContent = "Check API Connectivity";
    debugButton.style.marginTop = "10px";
    debugButton.style.padding = "5px 10px";
    debugButton.onclick = async function() {
        errorMessage.textContent = "Checking API endpoints...";
        let results = "API STATUS:\n";
        
        for (const endpoint of API_ENDPOINTS) {
            try {
                const url = `${API_BASE_URL}${endpoint}`;
                const response = await fetch(url, {
                    method: endpoint === '/api/login' ? 'POST' : 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: endpoint === '/api/login' ? JSON.stringify({
                        userId: 'test',
                        password: 'test'
                    }) : undefined
                });
                
                results += `${endpoint}: ${response.status} ${response.statusText}\n`;
                console.log(`${endpoint}: ${response.status} ${response.statusText}`);
            } catch (error) {
                results += `${endpoint}: ERROR - ${error.message}\n`;
                console.error(`${endpoint} error:`, error);
            }
        }
        
        errorMessage.textContent = "Connection test complete. See console.";
        console.log(results);
        alert(results);
    };
    
    // Add button to the page
    document.querySelector('.login-container').appendChild(debugButton);
}

// Run debug check when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only run in deployed environment
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        checkApiStatus();
    }
});

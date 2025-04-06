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
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem('userId', 'guest');
    
    window.location.href = "../HOME/home.html";
}

function createDemoUser() {
    localStorage.setItem('demoUser', JSON.stringify({
        userId: "demo",
        password: "demo123",
        name: "Demo User",
        email: "demo@example.com",
        role: "user"
    }));
    console.log("Demo user created - use demo/demo123 to login");
}

createDemoUser();

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("userId").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");

    errorMessage.textContent = "";
    successMessage.textContent = "";
    successMessage.style.display = "none";
    
    errorMessage.textContent = "Processing...";
    
    const demoUser = JSON.parse(localStorage.getItem('demoUser') || '{}');
    if (userId === demoUser.userId && password === demoUser.password) {
        errorMessage.textContent = "";
        successMessage.textContent = "Login successful! Redirecting...";
        successMessage.style.display = "block";
        
        localStorage.setItem('userId', userId);
        localStorage.setItem('demoMode', 'true');
        
        setTimeout(() => {
            window.location.href = "../HOME/home.html";
        }, 1000);
        return;
    }

    try {
        // Use the centralized config for API URL if available, otherwise fall back to default
        const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'https://icb-tracking-website.vercel.app';
        
        // For local testing - if running on localhost, use local API
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiUrl = isLocalhost ? 'http://localhost:5000' : API_BASE_URL;
        
        console.log(`Using API URL: ${apiUrl}/api/login`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10 seconds
        
        try {
            const response = await fetch(`${apiUrl}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    password
                }),
                signal: controller.signal,
                credentials: 'include' // Include credentials for CORS
            });
            
            clearTimeout(timeoutId);
            
            if (response.status === 401) {
                errorMessage.innerHTML = "Invalid username or password. You can use demo/demo123 or <a href='#' onclick='guestLogin()'>continue as guest</a>";
                return;
            }
            
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                throw new Error("Unable to parse server response");
            }
            
            if (!response.ok) {
                throw new Error(data.message || `Server error (${response.status})`);
            }
            
            successMessage.textContent = "Login successful! Redirecting...";
            successMessage.style.display = "block";
            errorMessage.textContent = "";
            
            localStorage.setItem('userId', userId);
            
            setTimeout(() => {
                window.location.href = "../HOME/home.html";
            }, 1000);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            if (fetchError.name === 'AbortError') {
                throw new Error("Request timed out. Server may be unavailable.");
            }
            
            throw fetchError;
        }
    } catch (error) {
        console.error("Login error:", error);
        errorMessage.innerHTML = `${error.message}. You can <a href='#' onclick='guestLogin()'>continue as guest</a> or use demo/demo123`;
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
    
    const demoUser = JSON.parse(localStorage.getItem('demoUser') || '{}');
    if (userId === demoUser.userId) {
        demoUser.password = newPassword;
        localStorage.setItem('demoUser', JSON.stringify(demoUser));
        
        successMessage.textContent = "Demo password reset successfully!";
        successMessage.style.display = "block";
        
        setTimeout(() => {
            document.getElementById("resetPasswordForm").reset();
            closeModal();
        }, 2000);
        return;
    }

    try {
        // Use the centralized config for API URL if available, otherwise fall back to default
        const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'https://icb-tracking-website.vercel.app';
        
        // For local testing - if running on localhost, use local API
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiUrl = isLocalhost ? 'http://localhost:5000' : API_BASE_URL;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10 seconds
        
        try {
            const response = await fetch(`${apiUrl}/api/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    newPassword
                }),
                signal: controller.signal,
                credentials: 'include' // Include credentials for CORS
            });
            
            clearTimeout(timeoutId);
            
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                throw new Error("Unable to parse server response");
            }
            
            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }
            
            successMessage.textContent = "Password reset successfully!";
            successMessage.style.display = "block";
            
            setTimeout(() => {
                document.getElementById("resetPasswordForm").reset();
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
        errorMessage.textContent = error.message;
    }
});

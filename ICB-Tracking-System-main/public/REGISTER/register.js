// Toggle Password Visibility
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

// Handle Form Submission
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById("userId").value;
    const name = document.getElementById("name").value;
    const contact = document.getElementById("contact").value;
    const email = document.getElementById("email").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");

    errorMessage.textContent = "";
    successMessage.textContent = "";
    successMessage.style.display = "none";
    
    // Field validation
    if (!userId || !name || !contact || !email || !newPassword) {
        errorMessage.textContent = "All fields are required!";
        return;
    }

    // Password match validation
    if (newPassword !== confirmPassword) {
        errorMessage.textContent = "Passwords do not match!";
        return;
    }

    // Display loading state
    errorMessage.textContent = "Processing registration...";

    try {
        // Prepare the user data
        const userData = {
            userId: userId,
            name: name,
            contact: contact,
            email: email,
            password: newPassword
        };
        
        console.log("Sending registration data");
        
        // Use an appropriate retry mechanism
        const maxRetries = 2;
        let retryCount = 0;
        let success = false;
        
        while (retryCount <= maxRetries && !success) {
            try {
                // Sending data to the server
                const response = await fetch('https://icb-tracking-website.vercel.app/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(userData),
                    timeout: 10000 // 10 second timeout
                });
                
                // Log response status
                console.log("Registration response status:", response.status);
                
                // Parse the response data
                let data;
                try {
                    data = await response.json();
                    console.log("Registration response received");
                } catch (jsonError) {
                    console.error("Error parsing response:", jsonError);
                    throw new Error("Server returned invalid data. Please try again.");
                }
                
                if (response.status === 400 && data.message.includes("already exists")) {
                    throw new Error("User ID or Email already exists. Please use different credentials.");
                }
                
                if (!response.ok) {
                    throw new Error(data.message || 'Registration failed');
                }
                
                success = true;
                
                // Clear the form
                document.getElementById('registerForm').reset();
                
                // Save user info and show success
                localStorage.setItem('registeredUserId', userId);
                
                // Show success message
                errorMessage.textContent = "";
                successMessage.textContent = "Registration successful! Redirecting to login...";
                successMessage.style.display = "block";
                
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = "../STUDENTLOGIN/studentlogin.html";
                }, 2000);
                
            } catch (fetchError) {
                retryCount++;
                if (retryCount > maxRetries) {
                    throw fetchError;
                }
                console.log(`Retrying registration (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
    } catch (error) {
        console.error("Registration error:", error);
        errorMessage.textContent = error.message || "Registration failed. Please try again.";
        successMessage.style.display = "none";
    }
});

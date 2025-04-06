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
        
        console.log("Sending registration data:", JSON.stringify(userData));
        
        // Sending data to the server
        const response = await fetch('https://icb-tracking-website.vercel.app/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        // Log response status
        console.log("Registration response status:", response.status);
        
        // Parse the response data
        let data;
        try {
            data = await response.json();
            console.log("Registration response data:", data);
        } catch (jsonError) {
            console.error("Error parsing response:", jsonError);
            throw new Error("Server returned invalid data. Please try again.");
        }

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        // Clear the form
        document.getElementById('registerForm').reset();
        
        // Also save to localStorage as a backup
        localStorage.setItem('lastRegisteredUser', JSON.stringify({
            userId: userId,
            name: name,
            email: email,
            registeredAt: new Date().toISOString()
        }));

        // Show success message
        errorMessage.textContent = "";
        successMessage.textContent = "Registration successful! Redirecting to login...";
        successMessage.style.display = "block";

        // Redirect to login after 2 seconds
        setTimeout(() => {
            window.location.href = "../STUDENTLOGIN/studentlogin.html";
        }, 2000);
    } catch (error) {
        console.error("Registration error:", error);
        errorMessage.textContent = error.message || "Registration failed. Please try again.";
        successMessage.style.display = "none";
    }
});

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

    // Password match validation
    if (newPassword !== confirmPassword) {
        errorMessage.textContent = "Passwords do not match!";
        return;
    }

    try {
        // Sending data to the server
        const response = await fetch('https://icb-tracking-website.vercel.app/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                name,
                contact,
                email,
                password: newPassword
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        successMessage.textContent = "Registration successful! Redirecting to login...";
        successMessage.style.display = "block";

        // Redirect to login after 2 seconds
        setTimeout(() => {
            window.location.href = "../STUDENTLOGIN/studentlogin.html";
        }, 2000);
    } catch (error) {
        errorMessage.textContent = error.message;
    }
});

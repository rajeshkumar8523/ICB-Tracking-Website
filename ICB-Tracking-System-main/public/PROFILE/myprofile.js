// Use the centralized config for API URL
const API_URL = window.APP_CONFIG ? `${window.APP_CONFIG.API_BASE_URL}/api/profile` : 'https://icb-tracking-website.vercel.app/api/profile';

document.getElementById('imageUpload').addEventListener('change', uploadImage);

function uploadImage() {
    const file = document.getElementById('imageUpload').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profileImg').src = e.target.result;
            localStorage.setItem('profileImg', e.target.result);
        }
        reader.readAsDataURL(file);
    }
}

function editField(fieldId) {
    const field = document.getElementById(fieldId);
    field.disabled = false;
    field.focus();
}

async function saveProfile() {
    const userProfile = {
        userId: document.getElementById('userId').value,
        fullName: document.getElementById('fullName').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        dob: document.getElementById('dob').value,
        email: document.getElementById('email').value,
        gender: document.getElementById('gender').value,
        branchYear: document.getElementById('branchYear').value,
        profileImg: localStorage.getItem('profileImg') || "default-profile.jpg",
    };

    localStorage.setItem('userProfile', JSON.stringify(userProfile));

    document.getElementById('nameDisplay').textContent = userProfile.fullName.toUpperCase();

    for (const key in userProfile) {
        document.getElementById(key).disabled = true;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userProfile),
        });

        if (response.ok) alert("Profile saved successfully!");
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

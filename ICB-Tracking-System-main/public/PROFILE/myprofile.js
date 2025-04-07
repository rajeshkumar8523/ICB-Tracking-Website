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
        branch: document.getElementById('branch').value,
        year: document.getElementById('year').value,
        profileImg: localStorage.getItem('profileImg') || "default-profile.jpg",
    };

    localStorage.setItem('userProfile', JSON.stringify(userProfile));

    document.getElementById('nameDisplay').textContent = userProfile.fullName.toUpperCase();

    // Disable all fields after saving
    const fields = ['userId', 'fullName', 'phoneNumber', 'dob', 'email', 'gender', 'branch', 'year'];
    fields.forEach(fieldId => {
        document.getElementById(fieldId).disabled = true;
    });

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userProfile),
        });

        if (response.ok) {
            alert("Profile saved successfully!");
        } else {
            throw new Error("Failed to save profile");
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Function to load profile data
function loadProfile() {
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        document.getElementById('userId').value = profile.userId || '';
        document.getElementById('fullName').value = profile.fullName || '';
        document.getElementById('phoneNumber').value = profile.phoneNumber || '';
        document.getElementById('dob').value = profile.dob || '';
        document.getElementById('email').value = profile.email || '';
        document.getElementById('gender').value = profile.gender || '';
        document.getElementById('branch').value = profile.branch || '';
        document.getElementById('year').value = profile.year || '';
        document.getElementById('nameDisplay').textContent = (profile.fullName || '').toUpperCase();
        
        if (profile.profileImg && profile.profileImg !== "default-profile.jpg") {
            document.getElementById('profileImg').src = profile.profileImg;
        }
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    
    document.getElementById('editButton').addEventListener('click', () => {
        const fields = ['userId', 'fullName', 'phoneNumber', 'dob', 'email', 'gender', 'branch', 'year'];
        fields.forEach(fieldId => {
            document.getElementById(fieldId).disabled = false;
        });
        document.getElementById('editButton').style.display = 'none';
        document.getElementById('saveButton').style.display = 'block';
    });

    document.getElementById('saveButton').addEventListener('click', saveProfile);
});

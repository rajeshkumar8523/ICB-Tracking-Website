// Use the centralized config for API URL
const API_URL = window.APP_CONFIG ? `${window.APP_CONFIG.API_BASE_URL}/api/me` : 'https://iot-tracker-api.vercel.app/api/me';

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('imageUpload').addEventListener('change', uploadImage);
    document.getElementById('editButton').addEventListener('click', enableEditing);
    document.getElementById('saveButton').addEventListener('click', saveProfile);
    
    // Load user profile
    loadProfile();
});

async function loadProfile() {
    // First check localStorage for quick display
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        displayProfile(profile);
    }

    try {
        // Then fetch from server for most up-to-date data
        const userId = localStorage.getItem('userId'); // Ensure userId is stored in localStorage
        if (!userId) {
            throw new Error('User ID not found in localStorage');
        }
        const response = await fetch(`${API_URL}/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const serverProfile = await response.json();
            displayProfile(serverProfile.data.user);
            // Update localStorage with fresh data
            localStorage.setItem('userProfile', JSON.stringify(serverProfile.data.user));
        } else {
            throw new Error('Failed to fetch profile');
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

function displayProfile(profile) {
    if (!profile) return;

    // Set all field values
    if (profile.userId) document.getElementById('userId').value = profile.userId;
    if (profile.fullName) {
        document.getElementById('fullName').value = profile.fullName;
        document.getElementById('nameDisplay').textContent = profile.fullName.toUpperCase();
    }
    if (profile.phoneNumber) document.getElementById('phoneNumber').value = profile.phoneNumber;
    if (profile.email) document.getElementById('email').value = profile.email;
    if (profile.branchYear) document.getElementById('branchYear').value = profile.branchYear;
    if (profile.profileImg && profile.profileImg !== "default-profile.jpg") {
        document.getElementById('profileImg').src = profile.profileImg;
    }
}

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

function enableEditing() {
    const fields = ['userId', 'fullName', 'phoneNumber', 'email', 'branchYear'];
    fields.forEach(fieldId => {
        document.getElementById(fieldId).disabled = false;
    });
    
    document.getElementById('editButton').style.display = 'none';
    document.getElementById('saveButton').style.display = 'block';
}

function disableEditing() {
    const fields = ['userId', 'fullName', 'phoneNumber', 'email', 'branchYear'];
    fields.forEach(fieldId => {
        document.getElementById(fieldId).disabled = true;
    });
    
    document.getElementById('editButton').style.display = 'block';
    document.getElementById('saveButton').style.display = 'none';
}

async function saveProfile() {
    const userProfile = {
        userId: document.getElementById('userId').value,
        fullName: document.getElementById('fullName').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        email: document.getElementById('email').value,
        branchYear: document.getElementById('branchYear').value,
        profileImg: localStorage.getItem('profileImg') || "default-profile.jpg",
    };

    try {
        const response = await fetch(`${API_URL}/${userProfile.userId}`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(userProfile),
        });

        if (response.ok) {
            const updatedProfile = await response.json();
            localStorage.setItem('userProfile', JSON.stringify(updatedProfile.data.user));
            displayProfile(updatedProfile.data.user);
            disableEditing();
            alert("Profile saved successfully!");
        } else {
            throw new Error('Failed to save profile');
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

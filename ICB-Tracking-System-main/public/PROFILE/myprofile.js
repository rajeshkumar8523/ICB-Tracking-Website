// *js*


const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'https://icb-tracking-website.vercel.app';

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('imageUpload').addEventListener('change', uploadImage);
    document.getElementById('editButton').addEventListener('click', enableEditing);
    document.getElementById('saveButton').addEventListener('click', saveProfile);
    
    // Load user profile
    loadProfile();
});

async function loadProfile() {
    // Get userId from localStorage
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('Please login first!');
        window.location.href = '../STUDENTLOGIN/studentlogin.html';
        return;
    }

    try {
        // Fetch user data from the server
        const response = await fetch(`${API_BASE_URL}/api/me/${userId}`);

        if (!response.ok) {
            throw new Error('Failed to fetch profile data');
        }

        const data = await response.json();
        if (data.status === 'success' && data.data.user) {
            displayProfile(data.data.user);
            // Store in localStorage for future use
            localStorage.setItem('userProfile', JSON.stringify(data.data.user));
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        
        // If API fails, try loading from localStorage as fallback
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
            displayProfile(JSON.parse(savedProfile));
        }
    }
}

function displayProfile(profile) {
    if (!profile) return;

    // Set all field values
    if (profile.userId) document.getElementById('userId').value = profile.userId;
    if (profile.name) {
        document.getElementById('fullName').value = profile.name;
        document.getElementById('nameDisplay').textContent = profile.name.toUpperCase();
    }
    if (profile.contact) document.getElementById('phoneNumber').value = profile.contact;
    if (profile.dob) document.getElementById('dob').value = profile.dob;
    if (profile.email) document.getElementById('email').value = profile.email;
    if (profile.gender) document.getElementById('gender').value = profile.gender;
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
    const fields = ['userId', 'fullName', 'phoneNumber', 'dob', 'email', 'gender', 'branchYear'];
    fields.forEach(fieldId => {
        document.getElementById(fieldId).disabled = false;
    });
    
    document.getElementById('editButton').style.display = 'none';
    document.getElementById('saveButton').style.display = 'block';
}

function disableEditing() {
    const fields = ['userId', 'fullName', 'phoneNumber', 'dob', 'email', 'gender', 'branchYear'];
    fields.forEach(fieldId => {
        document.getElementById(fieldId).disabled = true;
    });
    
    document.getElementById('editButton').style.display = 'block';
    document.getElementById('saveButton').style.display = 'none';
}

async function saveProfile() {
    const userProfile = {
        userId: document.getElementById('userId').value,
        name: document.getElementById('fullName').value,
        contact: document.getElementById('phoneNumber').value,
        dob: document.getElementById('dob').value,
        email: document.getElementById('email').value,
        gender: document.getElementById('gender').value,
        branchYear: document.getElementById('branchYear').value,
        profileImg: localStorage.getItem('profileImg') || "default-profile.jpg",
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/profile/update`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
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
            // If server update fails, at least update local storage
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
            disableEditing();
            alert("Profile saved locally (offline mode)");
        }
    } catch (error) {
        // Save to localStorage if API fails
        localStorage.setItem('userProfile', JSON.stringify(userProfile));
        disableEditing();
        alert("Profile saved locally (offline mode)");
    }
}

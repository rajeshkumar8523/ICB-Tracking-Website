// Use the centralized config for API URL
const API_URL = window.APP_CONFIG ? `${window.APP_CONFIG.API_BASE_URL}/api/profile` : 'https://icb-tracking-website.vercel.app/api/profile';

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('imageUpload').addEventListener('change', uploadImage);
    document.getElementById('editButton').addEventListener('click', enableEditing);
    document.getElementById('saveButton').addEventListener('click', saveProfile);
    
    // Load user profile
    loadProfile();
});

 
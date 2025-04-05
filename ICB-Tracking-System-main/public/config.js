// Configuration file for API endpoints

// For local development, use localhost
let API_BASE_URL = 'http://localhost:5000';

// Override with environment-based URL if available
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  // For production, use the Vercel deployed backend URL
  // Replace this with your actual backend URL after deployment
  API_BASE_URL = 'https://your-backend-url.vercel.app';
}

// Export the config
window.APP_CONFIG = {
  API_BASE_URL
}; 
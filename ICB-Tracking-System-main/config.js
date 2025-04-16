

// Configuration file for API endpoints and application settings

(function() {
try {
// Detect environment - This can be used for automatic environment switching
const hostname = window.location.hostname;

// Default to production (Vercel deployment)
let API_BASE_URL = 'https://iot-tracker-api.vercel.app'; // Updated API URL
let environment = 'production';

// If running locally, use localhost
if (hostname === 'localhost' || hostname === '127.0.0.1') {
API_BASE_URL = 'http://localhost:3000';
environment = 'development';
}

// For testing, log the API URL and environment
console.log(`[config.js] Environment: ${environment}`);
console.log(`[config.js] Using API URL: ${API_BASE_URL}`);

// Socket.io configuration - simplified for Vercel
const socketConfig = {
path: '/socket.io',
transports: ['websocket', 'polling'], // Enable both websocket and polling
reconnection: true,
reconnectionAttempts: 3,
reconnectionDelay: 2000,
timeout: 10000,
forceNew: true,
autoConnect: true, // Automatically connect
withCredentials: false,
query: {
"client": "web",
"version": "1.0.0"
}
};

// Store configuration in global variable
window.APP_CONFIG = {
API_BASE_URL,
environment,
version: '1.0.0',
allowGuestMode: true,
allowDemoMode: true,
socketConfig,
featureFlags: {
socketEnabled: true, // Enable socket in all environments
offline: false
}
};

// Add a method to check if we're running in offline mode
window.APP_CONFIG.isOffline = function() {
return !navigator.onLine || this.featureFlags.offline;
};

// Add a helper method to create socket connections
window.APP_CONFIG.createSocketConnection = function() {
if (!window.io) {
console.error('[config.js] Socket.io library not loaded');
return null;
}

try {
// Create socket connection with adapted config
const socket = io(this.API_BASE_URL, this.socketConfig);

// Add global error handlers
socket.on('connect_error', (err) => {
console.error('[config.js] Socket connection error:', err);
// In production Vercel, just disable the socket functionality
if (this.environment === 'production') {
this.featureFlags.socketEnabled = false;
socket.disconnect();
}
});

return socket;
} catch (e) {
console.error('[config.js] Failed to create socket connection:', e);
return null;
}
};

// Log success message
console.log('[config.js] Configuration loaded successfully');

// Dispatch an event when config is loaded
const configLoadedEvent = new CustomEvent('app-config-loaded', {
detail: { config: window.APP_CONFIG }
});
document.dispatchEvent(configLoadedEvent);

} catch (error) {
console.error('[config.js] Error setting up configuration:', error);

// Provide fallback configuration to prevent application crash
window.APP_CONFIG = window.APP_CONFIG || {
API_BASE_URL: 'https://iot-tracker-api.vercel.app', // Updated API URL
environment: 'production',
version: '1.0.0',
allowGuestMode: true,
allowDemoMode: true,
featureFlags: {
socketEnabled: false,
offline: false
},
isOffline: function() {
return !navigator.onLine || this.featureFlags.offline;
}
};

// Dispatch error event
const configErrorEvent = new CustomEvent('app-config-error', {
detail: { error: error.message }
});
document.dispatchEvent(configErrorEvent);
}
})();

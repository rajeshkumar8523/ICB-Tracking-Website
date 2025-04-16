// Use the centralized config for API URL
const API_BASE_URL = "https://iot-tracker-api.vercel.app/trackers/"; // Use the API URL from config.js

// Get bus number from URL or default to ESP32_001
const urlParams = new URLSearchParams(window.location.search);
const busNumber = urlParams.get('bus') || 'ESP32_001';

// Default coordinates for initial map view (center of Hyderabad)
const defaultCoordinates = [17.3850, 78.4867];
let hasLoadedLocation = false;

// Initialize the map
const map = L.map('map').setView(defaultCoordinates, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Custom bus icon
const busIcon = L.icon({
iconUrl: 'https://cdn-icons-png.flaticon.com/512/477/477103.png',
iconSize: [40, 40],
iconAnchor: [20, 40],
popupAnchor: [0, -40]
});

// Create bus marker with default position
let busMarker = L.marker(defaultCoordinates, { icon: busIcon }).addTo(map);
busMarker.bindPopup(`Bus ${busNumber}`).openPopup();

// Add loading overlay
const loadingOverlay = document.createElement('div');
loadingOverlay.className = 'loading-overlay';
loadingOverlay.innerHTML = '<div class="spinner"></div><p>Loading bus location...</p>';
document.body.appendChild(loadingOverlay);

// Create socket connection using the config
const socket = window.APP_CONFIG.createSocketConnection();

// Join the bus room after connecting
socket.on('connect', () => {
socket.emit('joinBus', busNumber);
});

// Update header with bus number
document.getElementById('busHeader').textContent = `🚌 Bus No ${busNumber}`;
document.getElementById('busNumber').textContent = `Bus No: ${busNumber}`;

// Function to handle API errors
function handleApiError(error) {
console.error('API Error:', error);
document.getElementById('busRoute').textContent = 'Route: Error loading data';
document.getElementById('lastUpdate').textContent = 'Last update: Error';
hideLoadingOverlay();
}

// Hide loading overlay
function hideLoadingOverlay() {
loadingOverlay.style.display = 'none';
}

// Fetch bus data (route, contact, etc)
function fetchBusData() {
fetch(`${API_BASE_URL}/api/buses/${busNumber}`)
.then(response => {
if (!response.ok) {
throw new Error('Network response was not ok');
}
return response.json();
})
.then(result => {
if (result && result.data && result.data.bus) {
const bus = result.data.bus;

// Update header
document.getElementById('busHeader').textContent = `🚌 Bus No ${busNumber}`;

// Update contact info if available
if (bus.contactNumber) {
document.getElementById('callLink').href = `tel:${bus.contactNumber}`;
document.getElementById('smsLink').href = `sms:${bus.contactNumber}`;
}

// Update route info
if (bus.route) {
document.getElementById('busRoute').textContent = `Route: ${bus.route}`;
}

// Update bus number display
document.getElementById('busNumber').textContent = `Bus No: ${busNumber}`;

// If bus has location data and we haven't loaded location yet, update the map immediately
if (bus.latitude && bus.longitude && !hasLoadedLocation) {
updateBusPosition({
latitude: bus.latitude,
longitude: bus.longitude,
speed: 0,
direction: 0,
timestamp: bus.lastUpdated || new Date()
});
hasLoadedLocation = true;
hideLoadingOverlay();
}

// Update location status
if (bus.latitude && bus.longitude) {
document.getElementById('locationStatus').textContent = 'Location tracking is active.';
document.getElementById('locationStatus').style.color = 'green';
} else {
document.getElementById('locationStatus').textContent = 'Waiting for location signal...';
document.getElementById('locationStatus').style.color = 'orange';
}
}
})
.catch(error => {
console.error('Error fetching bus data:', error);
document.getElementById('busRoute').textContent = 'Route: Information not available';
document.getElementById('locationStatus').textContent = 'Location system offline';
document.getElementById('locationStatus').style.color = 'red';
handleApiError(error);
});
}

// Fetch latest location data
function fetchLatestLocation() {
// First try to get the bus data with location
fetch(`${API_BASE_URL}/api/buses/${busNumber}`)
.then(response => {
if (!response.ok) {
throw new Error('Network response was not ok');
}
return response.json();
})
.then(result => {
if (result && result.data && result.data.bus &&
result.data.bus.latitude && result.data.bus.longitude) {
// Bus has location data, use it
updateBusPosition({
latitude: result.data.bus.latitude,
longitude: result.data.bus.longitude,
speed: 0, // Bus document doesn't have speed
direction: 0, // Bus document doesn't have direction
timestamp: result.data.bus.lastUpdated || new Date()
});
hideLoadingOverlay();
} else {
// Fallback to tracker data if bus doesn't have location
fetchTrackerLocation();
}
})
.catch(error => {
console.error('Error fetching bus data:', error);
// Try tracker data as fallback
fetchTrackerLocation();
});
}

// Fetch tracker location as fallback
function fetchTrackerLocation() {
fetch(`${API_BASE_URL}/trackers/${busNumber}?limit=1`)
.then(response => {
if (!response.ok) {
throw new Error('Network response was not ok');
}
return response.json();
})
.then(result => {
if (result && result.data && result.data.trackers && result.data.trackers.length > 0) {
const lastLocation = result.data.trackers[0];
updateBusPosition(lastLocation);
hideLoadingOverlay();
} else {
document.getElementById('lastUpdate').textContent = 'Last update: Waiting for first signal';
// If we still don't have location data after trying both methods, hide loading
hideLoadingOverlay();
}
})
.catch(error => {
console.error('Error fetching location:', error);
document.getElementById('lastUpdate').textContent = 'Last update: Signal lost';
hideLoadingOverlay();
});
}

// Function to update bus position on map
function updateBusPosition(data) {
const { latitude, longitude, speed, direction, timestamp } = data;

// Update marker position
busMarker.setLatLng([latitude, longitude]);

// Update info panel
document.getElementById('busSpeed').textContent = `Speed: ${speed ? speed.toFixed(1) + ' km/h' : 'N/A'}`;

const now = new Date();
const updateTime = new Date(timestamp);
const secondsAgo = Math.floor((now - updateTime) / 1000);

let timeText;
if (secondsAgo < 60) {
timeText = 'Just now';
} else if (secondsAgo < 3600) {
timeText = `${Math.floor(secondsAgo / 60)} minutes ago`;
} else {
timeText = `${Math.floor(secondsAgo / 3600)} hours ago`;
}

document.getElementById('lastUpdate').textContent = `Last update: ${timeText}`;

// Update location status
if (secondsAgo < 300) { // Less than 5 minutes
document.getElementById('locationStatus').textContent = 'Location tracking is active.';
document.getElementById('locationStatus').style.color = 'green';
} else if (secondsAgo < 900) { // Less than 15 minutes
document.getElementById('locationStatus').textContent = 'Location signal delayed.';
document.getElementById('locationStatus').style.color = 'orange';
} else {
document.getElementById('locationStatus').textContent = 'Location signal lost.';
document.getElementById('locationStatus').style.color = 'red';
}

// Rotate icon based on direction if available
if (direction !== undefined) {
// Currently the icon rotation is not supported in the version of Leaflet being used
// This is a placeholder for future implementation
}

// Center map on bus position and zoom in appropriately
map.setView([latitude, longitude], 15);

// Mark that we've loaded location data
hasLoadedLocation = true;
}

// Listen for real-time updates
socket.on('busLocation', (data) => {
if (data.busNumber === busNumber) {
updateBusPosition(data);
hideLoadingOverlay();
}
});

// Highlight active footer item
function highlight(element) {
document.querySelectorAll(".footer-item").forEach(item => {
item.classList.remove("active");
});
element.classList.add("active");
}

// Initial fetch and periodic updates
document.addEventListener('DOMContentLoaded', () => {
fetchBusData();
fetchLatestLocation();

// Set a timeout to hide loading overlay even if we can't get location
setTimeout(hideLoadingOverlay, 10000);

// Periodically check for location updates
setInterval(fetchLatestLocation, 10000); // Check every 10 seconds
});

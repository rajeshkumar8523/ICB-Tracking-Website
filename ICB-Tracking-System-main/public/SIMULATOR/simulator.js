// Use the centralized config for API URL
API_BASE_URL = 'https://icb-tracking-website.vercel.app';
const socket = io(API_BASE_URL);

// Default coordinates (center of Hyderabad)
const defaultCoordinates = [17.3850, 78.4867];
let selectedLocation = null;
let busMarker = null;

// DOM Elements
const locationForm = document.getElementById('locationForm');
const busSelect = document.getElementById('busSelect');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const speedInput = document.getElementById('speed');
const directionInput = document.getElementById('direction');
const useMapBtn = document.getElementById('useMapBtn');
const confirmLocationBtn = document.getElementById('confirmLocationBtn');
const cancelMapBtn = document.getElementById('cancelMapBtn');
const formSection = document.querySelector('.form-section');
const mapSection = document.getElementById('mapSection');
const resultMessage = document.getElementById('resultMessage');

// Initialize the map
const map = L.map('map').setView(defaultCoordinates, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Custom bus icon
const busIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/477/477103.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});

// Fetch buses from API and populate the select dropdown
function fetchBuses() {
    fetch(`${API_BASE_URL}/api/buses`)
        .then(response => response.json())
        .then(result => {
            if (result && result.data && result.data.buses) {
                const buses = result.data.buses;
                
                // Clear existing options except the default
                while (busSelect.options.length > 1) {
                    busSelect.remove(1);
                }
                
                // Add bus options
                buses.forEach(bus => {
                    const option = document.createElement('option');
                    option.value = bus.busNumber;
                    option.textContent = `Bus ${bus.busNumber} - ${bus.route}`;
                    busSelect.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Error fetching buses:', error);
            showMessage('Failed to load buses. Please try again.', 'error');
        });
}

// Function to show success or error message
function showMessage(text, type = 'success') {
    resultMessage.textContent = text;
    resultMessage.className = 'result-message ' + type;
    
    // Hide message after 5 seconds
    setTimeout(() => {
        resultMessage.textContent = '';
        resultMessage.className = 'result-message';
    }, 5000);
}

// Update bus location via API
function updateBusLocation(busNumber, latitude, longitude, speed, direction) {
    const data = {
        busNumber,
        latitude,
        longitude
    };
    
    if (speed) data.speed = speed;
    if (direction) data.direction = direction;
    
    fetch(`${API_BASE_URL}/api/trackers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            showMessage(`Bus ${busNumber} location updated successfully!`);
            
            // Also emit socket event
            socket.emit('locationUpdate', data);
        } else {
            throw new Error(result.message || 'Failed to update location');
        }
    })
    .catch(error => {
        console.error('Error updating location:', error);
        showMessage(`Error: ${error.message || 'Failed to update location'}`, 'error');
    });
}

// Handle form submission
locationForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const busNumber = busSelect.value;
    const latitude = parseFloat(latitudeInput.value);
    const longitude = parseFloat(longitudeInput.value);
    const speed = speedInput.value ? parseFloat(speedInput.value) : null;
    const direction = directionInput.value ? parseFloat(directionInput.value) : null;
    
    if (!busNumber) {
        showMessage('Please select a bus', 'error');
        return;
    }
    
    if (isNaN(latitude) || isNaN(longitude)) {
        showMessage('Please enter valid coordinates', 'error');
        return;
    }
    
    updateBusLocation(busNumber, latitude, longitude, speed, direction);
});

// Switch to map view
useMapBtn.addEventListener('click', function() {
    formSection.style.display = 'none';
    mapSection.style.display = 'block';
    
    // Get current values if any
    const busNumber = busSelect.value;
    const lat = parseFloat(latitudeInput.value) || defaultCoordinates[0];
    const lng = parseFloat(longitudeInput.value) || defaultCoordinates[1];
    
    // Center map on current coordinates if available
    map.setView([lat, lng], 13);
    
    // Add or update marker
    if (busMarker) {
        map.removeLayer(busMarker);
    }
    
    busMarker = L.marker([lat, lng], { icon: busIcon, draggable: true }).addTo(map);
    busMarker.bindPopup(busNumber ? `Bus ${busNumber}` : 'New Location').openPopup();
    
    selectedLocation = [lat, lng];
    
    // Update marker when dragged
    busMarker.on('dragend', function(e) {
        selectedLocation = [e.target.getLatLng().lat, e.target.getLatLng().lng];
    });
    
    // Ensure map is properly sized
    map.invalidateSize();
});

// Handle map click to set location
map.on('click', function(e) {
    selectedLocation = [e.latlng.lat, e.latlng.lng];
    
    if (busMarker) {
        map.removeLayer(busMarker);
    }
    
    busMarker = L.marker(selectedLocation, { icon: busIcon, draggable: true }).addTo(map);
    busMarker.bindPopup('Selected Location').openPopup();
    
    // Update marker when dragged
    busMarker.on('dragend', function(e) {
        selectedLocation = [e.target.getLatLng().lat, e.target.getLatLng().lng];
    });
});

// Confirm location from map
confirmLocationBtn.addEventListener('click', function() {
    if (!selectedLocation) {
        alert('Please click on the map to select a location');
        return;
    }
    
    // Update form with selected location
    latitudeInput.value = selectedLocation[0];
    longitudeInput.value = selectedLocation[1];
    
    // Switch back to form view
    mapSection.style.display = 'none';
    formSection.style.display = 'block';
});

// Cancel map selection
cancelMapBtn.addEventListener('click', function() {
    // Switch back to form view without updating
    mapSection.style.display = 'none';
    formSection.style.display = 'block';
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    fetchBuses();
}); 

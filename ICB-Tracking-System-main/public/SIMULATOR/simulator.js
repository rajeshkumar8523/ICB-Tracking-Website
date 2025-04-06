// Configuration
const API_BASE_URL = 'https://icb-backend.vercel.app';
const SOCKET_RECONNECTION_ATTEMPTS = 5;
const SOCKET_RECONNECTION_DELAY = 2000;
const HTTP_RETRY_ATTEMPTS = 2;

// State variables
let socket = null;
let map = null;
let marker = null;
let selectedLocation = null;
let currentBusId = '';
let httpRetryCount = 0;
let socketRetryCount = 0;
let socketConnected = false;

// DOM Elements
const connectionStatusEl = document.getElementById('connection-status');
const locationForm = document.getElementById('location-form');
const busIdSelect = document.getElementById('busId');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const updateLocationBtn = document.getElementById('update-location');
const openMapBtn = document.getElementById('open-map');
const confirmLocationBtn = document.getElementById('confirm-location');
const cancelLocationBtn = document.getElementById('cancel-location');
const resultContainer = document.getElementById('result-container');
const locationFormCard = document.getElementById('location-form-card');
const mapSection = document.getElementById('map-section');
const coordinatesDisplay = document.getElementById('coordinates-display');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    setupBusIdOptions();
    fetchLocations();
    setupFormListeners();
    initMap();
});

// Socket.io initialization
function initSocket() {
    try {
        // Check if Socket.io library is available
        if (typeof io === 'undefined') {
            showConnectionStatus(false, 'Socket.io library not loaded');
            console.error('Socket.io is not defined. The library may not be loaded correctly.');
            return;
        }

        // Initialize socket with connection options
        socket = io(API_BASE_URL, {
            reconnectionAttempts: SOCKET_RECONNECTION_ATTEMPTS,
            reconnectionDelay: SOCKET_RECONNECTION_DELAY,
            timeout: 10000,
            forceNew: true,
            transports: ['websocket', 'polling']
        });

        // Socket event listeners
        socket.on('connect', () => {
            console.log('Socket connected successfully');
            socketConnected = true;
            socketRetryCount = 0;
            showConnectionStatus(true, 'Connected to server');
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            socketConnected = false;
            showConnectionStatus(false, `Connection error: ${error.message}`);
            
            if (socketRetryCount < SOCKET_RECONNECTION_ATTEMPTS) {
                socketRetryCount++;
                showResultMessage(`Retrying connection (${socketRetryCount}/${SOCKET_RECONNECTION_ATTEMPTS})...`, 'warning');
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            socketConnected = false;
            showConnectionStatus(false, `Disconnected: ${reason}`);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log(`Socket reconnected after ${attemptNumber} attempts`);
            socketConnected = true;
            showConnectionStatus(true, 'Reconnected to server');
        });

        socket.on('reconnect_failed', () => {
            console.error('Failed to reconnect after maximum attempts');
            socketConnected = false;
            showConnectionStatus(false, 'Failed to reconnect');
            showResultMessage('Failed to reconnect to the server after multiple attempts. Please refresh the page.', 'error');
        });
    } catch (err) {
        console.error('Error initializing socket:', err);
        showConnectionStatus(false, 'Failed to initialize socket');
        showResultMessage(`Error initializing socket: ${err.message}`, 'error');
    }
}

// Show connection status
function showConnectionStatus(isConnected, message) {
    connectionStatusEl.className = isConnected ? 
        'connection-status status-connected' : 
        'connection-status status-disconnected';
    
    connectionStatusEl.innerHTML = `
        <i class="fas fa-${isConnected ? 'plug' : 'plug-circle-exclamation'}"></i>
        ${message || (isConnected ? 'Connected' : 'Disconnected')}
    `;
}

// Initialize the map
function initMap() {
    try {
        // Check if Leaflet library is available
        if (typeof L === 'undefined') {
            console.error('Leaflet is not defined. The library may not be loaded correctly.');
            showResultMessage('Map could not be initialized. Please refresh the page.', 'error');
            return;
        }
        
        // Create the map centered at Sydney, Australia
        map = L.map('map').setView([-33.8688, 151.2093], 12);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Add map click event listener
        map.on('click', handleMapClick);
    } catch (err) {
        console.error('Error initializing map:', err);
        showResultMessage(`Error initializing map: ${err.message}`, 'error');
    }
}

// Handle map click event
function handleMapClick(e) {
    try {
        // Update the marker position
        const { lat, lng } = e.latlng;
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            // Add drag event listener to the marker
            marker.on('dragend', function(event) {
                const position = marker.getLatLng();
                updateCoordinatesDisplay(position.lat, position.lng);
            });
        }
        
        // Update the coordinates display
        updateCoordinatesDisplay(lat, lng);
        selectedLocation = { latitude: lat, longitude: lng };
    } catch (err) {
        console.error('Error handling map click:', err);
        showResultMessage(`Error selecting location: ${err.message}`, 'error');
    }
}

// Update coordinates display
function updateCoordinatesDisplay(lat, lng) {
    if (coordinatesDisplay) {
        coordinatesDisplay.textContent = `Selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
}

// Setup bus ID options - Modified to fetch real bus data
function setupBusIdOptions() {
    try {
        // Try to fetch bus IDs from API
        fetch(`${API_BASE_URL}/api/buses`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch buses: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const buses = data.buses || [];
                populateBusDropdown(buses.length > 0 ? buses : ['BUS001', 'BUS002', 'BUS003', 'BUS004', 'BUS005']);
            })
            .catch(err => {
                console.error('Error fetching buses:', err);
                // Fallback to default bus IDs if API fails
                populateBusDropdown(['BUS001', 'BUS002', 'BUS003', 'BUS004', 'BUS005']);
            });
    } catch (err) {
        console.error('Error setting up bus ID options:', err);
        showResultMessage(`Error loading bus data: ${err.message}`, 'error');
        // Fallback to default bus IDs
        populateBusDropdown(['BUS001', 'BUS002', 'BUS003', 'BUS004', 'BUS005']);
    }
}

// Populate bus dropdown with IDs
function populateBusDropdown(buses) {
    // Clear existing options
    busIdSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a bus ID';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    busIdSelect.appendChild(defaultOption);
    
    // Add bus ID options
    buses.forEach(busId => {
        const option = document.createElement('option');
        // Handle if busId is an object or string
        option.value = typeof busId === 'object' ? busId.id || busId.busId : busId;
        option.textContent = typeof busId === 'object' ? busId.name || busId.id || busId.busId : busId;
        busIdSelect.appendChild(option);
    });
}

// Fetch locations from API
function fetchLocations() {
    try {
        // Try to fetch locations from API
        fetch(`${API_BASE_URL}/api/locations`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch locations: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const locations = data.locations || [];
                populateLocationDropdown(locations);
            })
            .catch(err => {
                console.error('Error fetching locations:', err);
                // Don't use a fallback for locations - leave dropdown empty if API fails
                showResultMessage('Could not load predefined locations', 'warning');
            });
    } catch (err) {
        console.error('Error fetching locations:', err);
        showResultMessage(`Error loading locations: ${err.message}`, 'warning');
    }
}

// Populate location dropdown
function populateLocationDropdown(locations) {
    // Set up location dropdown
    const locationSelect = document.getElementById('predefined-location');
    locationSelect.innerHTML = '<option value="" disabled selected>Select a location</option>';
    
    // Add location options
    locations.forEach(location => {
        if (location && location.name && location.coordinates) {
            const option = document.createElement('option');
            option.value = JSON.stringify(location.coordinates);
            option.textContent = location.name;
            locationSelect.appendChild(option);
        }
    });

    // Add event listener for location selection
    locationSelect.addEventListener('change', (e) => {
        try {
            if (e.target.value) {
                const coordinates = JSON.parse(e.target.value);
                const lat = coordinates.latitude || coordinates[0];
                const lng = coordinates.longitude || coordinates[1];
                
                if (lat && lng) {
                    latitudeInput.value = lat;
                    longitudeInput.value = lng;
                    
                    // If map is open, update marker
                    if (mapSection.style.display === 'block' && map) {
                        map.setView([lat, lng], 14);
                        if (marker) {
                            marker.setLatLng([lat, lng]);
                        } else {
                            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
                        }
                        updateCoordinatesDisplay(lat, lng);
                    }
                }
            }
        } catch (err) {
            console.error('Error selecting location:', err);
            showResultMessage(`Error selecting location: ${err.message}`, 'error');
        }
    });
}

// Setup form listeners
function setupFormListeners() {
    // Form submission
    locationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        updateBusLocation();
    });
    
    // Bus ID selection
    busIdSelect.addEventListener('change', (e) => {
        currentBusId = e.target.value;
    });
    
    // Open map button
    openMapBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openMapView();
    });
    
    // Confirm location button
    confirmLocationBtn.addEventListener('click', (e) => {
        e.preventDefault();
        confirmMapLocation();
    });
    
    // Cancel location button
    cancelLocationBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeMapView();
    });
}

// Open map view
function openMapView() {
    try {
        // Hide location form and show map
        locationFormCard.style.display = 'none';
        mapSection.style.display = 'block';
        
        // Get current coordinates
        const lat = parseFloat(latitudeInput.value) || -33.8688;
        const lng = parseFloat(longitudeInput.value) || 151.2093;
        
        // Update map view
        map.invalidateSize();
        map.setView([lat, lng], 13);
        
        // Update marker
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            // Add drag event listener to the marker
            marker.on('dragend', function(event) {
                const position = marker.getLatLng();
                updateCoordinatesDisplay(position.lat, position.lng);
            });
        }
        
        // Update coordinates display
        updateCoordinatesDisplay(lat, lng);
    } catch (err) {
        console.error('Error opening map view:', err);
        showResultMessage(`Error opening map: ${err.message}`, 'error');
    }
}

// Confirm map location
function confirmMapLocation() {
    try {
        if (marker) {
            const position = marker.getLatLng();
            latitudeInput.value = position.lat.toFixed(6);
            longitudeInput.value = position.lng.toFixed(6);
        }
        closeMapView();
    } catch (err) {
        console.error('Error confirming map location:', err);
        showResultMessage(`Error confirming location: ${err.message}`, 'error');
    }
}

// Close map view
function closeMapView() {
    locationFormCard.style.display = 'block';
    mapSection.style.display = 'none';
}

// Update bus location
async function updateBusLocation() {
    try {
        // Validate form inputs
        const busId = busIdSelect.value;
        const latitude = parseFloat(latitudeInput.value);
        const longitude = parseFloat(longitudeInput.value);
        
        if (!busId) {
            showResultMessage('Please select a bus ID', 'warning');
            return;
        }
        
        if (!latitude || isNaN(latitude) || !longitude || isNaN(longitude)) {
            showResultMessage('Please enter valid coordinates', 'warning');
            return;
        }
        
        // Disable form during submission
        toggleFormElements(true);
        showResultMessage('Updating bus location...', 'info');
        
        // Prepare the data
        const locationData = {
            busId,
            latitude,
            longitude,
            timestamp: new Date().toISOString()
        };
        
        // First try HTTP API
        const success = await updateViaHttp(locationData);
        
        // If socket is connected, also emit event
        if (socketConnected && socket) {
            try {
                socket.emit('update-bus-location', locationData);
                console.log('Emitted location update via socket:', locationData);
            } catch (socketErr) {
                console.error('Socket emit error:', socketErr);
                // We don't consider this a failure if HTTP succeeded
            }
        }
        
        // Show result message
        if (success) {
            showResultMessage('Bus location updated successfully!', 'success');
        }
        
        // Re-enable form
        toggleFormElements(false);
    } catch (err) {
        console.error('Error updating bus location:', err);
        showResultMessage(`Error updating location: ${err.message}`, 'error');
        toggleFormElements(false);
    }
}

// Update via HTTP API
async function updateViaHttp(locationData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/bus-location`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(locationData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: `HTTP error! Status: ${response.status}`
            }));
            
            if (httpRetryCount < HTTP_RETRY_ATTEMPTS) {
                httpRetryCount++;
                showResultMessage(`Retrying HTTP request (${httpRetryCount}/${HTTP_RETRY_ATTEMPTS})...`, 'warning');
                return await updateViaHttp(locationData);
            }
            
            throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        
        // Reset retry counter on success
        httpRetryCount = 0;
        return true;
    } catch (err) {
        if (httpRetryCount < HTTP_RETRY_ATTEMPTS) {
            httpRetryCount++;
            showResultMessage(`Network error, retrying (${httpRetryCount}/${HTTP_RETRY_ATTEMPTS})...`, 'warning');
            return await updateViaHttp(locationData);
        }
        
        throw err;
    }
}

// Toggle form elements
function toggleFormElements(disabled) {
    const formElements = locationForm.querySelectorAll('input, select, button');
    formElements.forEach(element => {
        element.disabled = disabled;
    });
    
    // Update button text
    updateLocationBtn.innerHTML = disabled ? 
        '<i class="fas fa-spinner fa-spin"></i> Updating...' : 
        '<i class="fas fa-location-arrow"></i> Update Location';
}

// Show result message with auto-hide
function showResultMessage(message, type) {
    if (!resultContainer) return;
    
    resultContainer.innerHTML = message;
    resultContainer.className = `result-message ${type || 'info'}`;
    resultContainer.style.display = 'block';
    
    // Auto-hide success and info messages after 5 seconds
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            resultContainer.style.display = 'none';
        }, 5000);
    }
}

// Error handler for unhandled promises
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showResultMessage(`Unexpected error: ${event.reason.message}`, 'error');
});

// Handle connection error during initialization
window.addEventListener('error', (event) => {
    // Only handle script and resource loading errors
    if (event.target && (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
        console.error('Resource loading error:', event);
        if (event.target.src && event.target.src.includes('socket.io')) {
            showConnectionStatus(false, 'Failed to load Socket.io');
        }
    }
}); 

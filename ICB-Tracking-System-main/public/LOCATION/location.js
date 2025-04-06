// Use the centralized config for API URL
const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'https://icb-tracking-website.vercel.app';
const MONGO_URI = 'mongodb+srv://rajesh:rajesh@cluster0.cqkgbx3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Get bus number from URL or default to 1
const urlParams = new URLSearchParams(window.location.search);
const busNumber = urlParams.get('bus') || '01';

// Default coordinates for initial map view (center of Hyderabad)
const defaultCoordinates = [17.3850, 78.4867];
let hasLoadedLocation = false;
let dbConnected = false;

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

// Connect to Socket.io server
let socket;
let failedSocketConnection = false;
let lastFetchAttempt = 0;
const FETCH_COOLDOWN = 5000; // 5 seconds cooldown between fetch attempts

// Check database connection status
async function checkDatabaseConnection() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/status`);
    if (response.ok) {
      const data = await response.json();
      dbConnected = data.dbConnected;
      console.log(`Database connection status: ${dbConnected ? 'Connected' : 'Disconnected'}`);
      return dbConnected;
    }
    return false;
  } catch (error) {
    console.error('Error checking database status:', error);
    return false;
  }
}

// Initialize socket connection using config if available
function initializeSocket() {
  try {
    // Check if socket.io is available
    if (typeof io === 'undefined') {
      console.error('Socket.io library not available');
      failedSocketConnection = true;
      return;
    }
    
    // Use the createSocketConnection helper from config.js if available
    if (window.APP_CONFIG && typeof window.APP_CONFIG.createSocketConnection === 'function') {
      console.log('Using APP_CONFIG to create socket connection');
      socket = window.APP_CONFIG.createSocketConnection();
    } else {
      // Fallback to direct connection
      console.log('Connecting to socket at:', API_BASE_URL);
      socket = io(API_BASE_URL, {
        path: '/socket.io',
        reconnectionAttempts: 5,
        timeout: 20000,
        transports: ['polling'], // Use only polling for better compatibility
        forceNew: true
      });
    }
    
    if (!socket) {
      console.error('Failed to create socket connection');
      failedSocketConnection = true;
      return;
    }
    
    // Join the bus room after connecting
    socket.on('connect', () => {
      console.log('Socket connected, joining bus room:', busNumber);
      socket.emit('joinBus', busNumber);
      failedSocketConnection = false;
    });
    
    // Listen for real-time updates
    socket.on('busLocation', (data) => {
      if (data.busNumber === busNumber) {
        console.log('Received real-time location for bus:', busNumber);
        updateBusPosition(data);
        hideLoadingOverlay();
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      failedSocketConnection = true;
      // On connection error, fallback to API polling
      fetchLatestLocation();
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      failedSocketConnection = true;
      // On socket error, fallback to API polling
      fetchLatestLocation();
    });
  } catch (e) {
    console.error('Failed to initialize socket:', e);
    failedSocketConnection = true;
    // On any socket initialization error, fallback to API polling
    fetchLatestLocation();
  }
}

// Update header with bus number
document.getElementById('busHeader').textContent = `🚌 Bus No ${busNumber}`;
document.getElementById('busNumber').textContent = `Bus No: ${busNumber}`;

// Function to handle API errors
function handleApiError(error) {
  console.error('API Error:', error);
  document.getElementById('busRoute').textContent = 'Route: Error loading data';
  document.getElementById('lastUpdate').textContent = 'Last update: Error';
  hideLoadingOverlay();
  
  // Add database connection message
  if (!dbConnected) {
    const infoPanel = document.querySelector('.info-panel');
    if (infoPanel) {
      const dbStatusMsg = document.createElement('div');
      dbStatusMsg.className = 'db-status-message';
      dbStatusMsg.innerHTML = `
        <p style="color: #d73a49; margin: 10px 0; padding: 8px; background-color: #fff5f5; border-radius: 4px; font-size: 14px; border: 1px solid #ffcdd2;">
          <strong>Database connection issue detected.</strong><br>
          Using local data for tracking.
        </p>
      `;
      if (!infoPanel.querySelector('.db-status-message')) {
        infoPanel.appendChild(dbStatusMsg);
      }
    }
  }
}

// Hide loading overlay
function hideLoadingOverlay() {
  loadingOverlay.style.display = 'none';
}

// Throttle function to prevent excessive API calls
function throttledFetch(fetchFunction) {
  const now = Date.now();
  if (now - lastFetchAttempt > FETCH_COOLDOWN) {
    lastFetchAttempt = now;
    fetchFunction();
  } else {
    console.log(`Throttling API call. Next available in ${(FETCH_COOLDOWN - (now - lastFetchAttempt))/1000}s`);
  }
}

// Fetch bus data with retry logic
function fetchBusData() {
  const fetchWithRetry = async (retries = 2) => {
    try {
      // Check DB connection status first
      await checkDatabaseConnection();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_BASE_URL}/api/buses/${busNumber}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
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
          document.getElementById('locationStatus').textContent = `Location tracking is active. Database: ${dbConnected ? 'Connected' : 'Fallback mode'}`;
          document.getElementById('locationStatus').style.color = dbConnected ? 'green' : 'orange';
        } else {
          document.getElementById('locationStatus').textContent = 'Waiting for location signal...';
          document.getElementById('locationStatus').style.color = 'orange';
        }
      }
    } catch (error) {
      console.error('Error fetching bus data:', error);
      
      if (error.name === 'AbortError') {
        console.log('Fetch timeout, moving to retry');
      }
      
      if (retries > 0) {
        console.log(`Retrying bus data fetch, ${retries} attempts left`);
        await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
        return fetchWithRetry(retries - 1);
      }
      
      document.getElementById('busRoute').textContent = 'Route: Information not available';
      document.getElementById('locationStatus').textContent = `Location system offline. Database: ${dbConnected ? 'Connected' : 'Disconnected'}`;
      document.getElementById('locationStatus').style.color = 'red';
      handleApiError(error);
    }
  };
  
  fetchWithRetry();
}

// Fetch latest location data with retry
function fetchLatestLocation() {
  const fetchWithRetry = async (retries = 2) => {
    try {
      // Check DB connection status first
      await checkDatabaseConnection();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // First try to get the bus data with location
      const response = await fetch(`${API_BASE_URL}/api/buses/${busNumber}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
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
        await fetchTrackerLocation();
      }
    } catch (error) {
      console.error('Error fetching bus data:', error);
      
      if (error.name === 'AbortError') {
        console.log('Fetch timeout, moving to retry');
      }
      
      if (retries > 0) {
        console.log(`Retrying location fetch, ${retries} attempts left`);
        await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
        return fetchWithRetry(retries - 1);
      }
      
      // Try tracker data as fallback
      await fetchTrackerLocation();
    }
  };
  
  fetchWithRetry();
}

// Fetch tracker location as fallback with retry
async function fetchTrackerLocation() {
  const fetchWithRetry = async (retries = 2) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_BASE_URL}/api/trackers/${busNumber}?limit=1`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result && result.data && result.data.trackers && result.data.trackers.length > 0) {
        const lastLocation = result.data.trackers[0];
        updateBusPosition(lastLocation);
        hideLoadingOverlay();
        
        // Update the DB status in the location status
        document.getElementById('locationStatus').textContent = `Location tracking is active. Database: ${dbConnected ? 'Connected' : 'Fallback mode'}`;
        document.getElementById('locationStatus').style.color = dbConnected ? 'green' : 'orange';
      } else {
        document.getElementById('lastUpdate').textContent = 'Last update: Waiting for first signal';
        document.getElementById('locationStatus').textContent = `Waiting for location data. Database: ${dbConnected ? 'Connected' : 'Disconnected'}`;
        // If we still don't have location data after trying both methods, hide loading
        hideLoadingOverlay();
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      
      if (error.name === 'AbortError') {
        console.log('Fetch timeout, moving to retry');
      }
      
      if (retries > 0) {
        console.log(`Retrying tracker location fetch, ${retries} attempts left`);
        await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
        return fetchWithRetry(retries - 1);
      }
      
      document.getElementById('lastUpdate').textContent = 'Last update: Signal lost';
      document.getElementById('locationStatus').textContent = `Location system offline. Database: ${dbConnected ? 'Connected' : 'Disconnected'}`;
      document.getElementById('locationStatus').style.color = 'red';
      hideLoadingOverlay();
    }
  };
  
  fetchWithRetry();
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
    document.getElementById('locationStatus').textContent = `Location tracking is active. Database: ${dbConnected ? 'Connected' : 'Fallback mode'}`;
    document.getElementById('locationStatus').style.color = dbConnected ? 'green' : 'orange';
  } else if (secondsAgo < 900) { // Less than 15 minutes
    document.getElementById('locationStatus').textContent = `Location signal delayed. Database: ${dbConnected ? 'Connected' : 'Fallback mode'}`;
    document.getElementById('locationStatus').style.color = 'orange';
  } else {
    document.getElementById('locationStatus').textContent = `Location signal lost. Database: ${dbConnected ? 'Connected' : 'Disconnected'}`;
    document.getElementById('locationStatus').style.color = 'red';
  }

  // Center map on bus position and zoom in appropriately
  map.setView([latitude, longitude], 15);
  
  // Mark that we've loaded location data
  hasLoadedLocation = true;
}

// Highlight active footer item
function highlight(element) {
  document.querySelectorAll(".footer-item").forEach(item => {
    item.classList.remove("active");
  });
  element.classList.add("active");
}

// Initial fetch and periodic updates
document.addEventListener('DOMContentLoaded', async () => {
  // Check database connection first
  await checkDatabaseConnection();
  
  fetchBusData();
  fetchLatestLocation();
  initializeSocket();
  
  // Set up backup polling for location updates (every 30 seconds)
  setInterval(() => {
    if (failedSocketConnection) {
      console.log("Using polling fallback due to socket connection failure");
      throttledFetch(fetchLatestLocation);
    }
  }, 30000);
  
  // Check database connection every 2 minutes
  setInterval(async () => {
    await checkDatabaseConnection();
    console.log(`Periodic check - Database connected: ${dbConnected}`);
    
    // Update status message
    if (!dbConnected) {
      document.getElementById('locationStatus').textContent = `Using fallback tracking mode. Database: Disconnected`;
      document.getElementById('locationStatus').style.color = 'orange';
    }
  }, 120000);
});

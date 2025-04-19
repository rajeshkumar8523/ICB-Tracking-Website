// location.js
// Define API Base URL directly
const API_BASE_URL = "https://iot-tracker-api.vercel.app";

function initApplication() {
  try {
    // Get tracker ID from URL or default to ESP32_001
    const urlParams = new URLSearchParams(window.location.search);
    // Use 'bus' parameter name as it's used in home.html link, but treat it as trackerId
    const trackerId = urlParams.get('bus') || 'ESP32_001'; 

    // Default coordinates for initial map view (center of Hyderabad)
    const defaultCoordinates = [17.3850, 78.4867]; 
    let hasLoadedLocation = false;
    let refreshInterval;

    // Initialize the map with error handling
    let map;
    try {
      map = L.map('map').setView(defaultCoordinates, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
    } catch (mapError) {
      console.error('Map initialization failed:', mapError);
      const mapElement = document.getElementById('map');
      if (mapElement) {
          mapElement.innerHTML = '<p class="error">Failed to load map. Please refresh the page.</p>';
      }
    }

    // Custom tracker icon (using the same bus icon for now)
    const trackerIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/477/477103.png', // Can be changed later
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });

    // Create tracker marker with default position
    let trackerMarker;
    if (map) {
      trackerMarker = L.marker(defaultCoordinates, { icon: trackerIcon }).addTo(map);
      trackerMarker.bindPopup(`Tracker ${trackerId}`).openPopup();
    }

     // Add loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="spinner"></div><p>Loading bus location...</p>';
    document.body.appendChild(loadingOverlay);

    // Simple API fetch function
    async function fetchApiData(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`API fetch failed for ${endpoint}:`, error);
            throw error; // Re-throw
        }
    }

    // Update header with tracker ID
    function updateTrackerInfo() {
      try {
        // Update header title
        const headerElement = document.getElementById('busHeader');
        if (headerElement) headerElement.textContent = `🛰️ Tracker ${trackerId}`;
        
        // Update info panel tracker number
        const busNumberElement = document.getElementById('busNumber');
        if (busNumberElement) busNumberElement.textContent = `Tracker ID: ${trackerId}`;

        // Remove or hide elements for unavailable data (Route, Call/SMS links)
        const routeElement = document.getElementById('busRoute');
        if (routeElement) routeElement.style.display = 'none'; // Hide route paragraph
        const callLink = document.getElementById('callLink');
        if (callLink) callLink.style.display = 'none'; // Hide call icon
        const smsLink = document.getElementById('smsLink');
        if (smsLink) smsLink.style.display = 'none'; // Hide SMS icon

      } catch (e) {
        console.error('Failed to update tracker info display:', e);
      }
    }

     // Function to handle API errors
     function handleApiError(error, context = "fetching data") {
        console.error(`API Error (${context}):`, error);
        try {
            const lastUpdateElement = document.getElementById('lastUpdate');
            if (lastUpdateElement) lastUpdateElement.textContent = 'Last update: Error loading data';
            updateLocationStatus(false, 'Error'); // Update status to show error
        } catch (e) {
            console.error('Failed to update error display:', e);
        }
        hideLoadingOverlay();
    }

     // Hide loading overlay
    function hideLoadingOverlay() {
      try {
        loadingOverlay.style.display = 'none';
      } catch (e) {
        console.error('Failed to hide loading overlay:', e);
      }
    }

    // Fetch latest location data for the tracker
    async function fetchTrackerLocation() {
        try {
            // Fetch the tracker data - API returns an array of location points
            const trackerDataArray = await fetchApiData(`/trackers/${trackerId}`);

            if (trackerDataArray && trackerDataArray.length > 0) {
                // Sort the array by timestamp in descending order to find the latest entry
                trackerDataArray.sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    // Handle invalid timestamps by treating them as older
                    if (isNaN(timeA)) return 1;
                    if (isNaN(timeB)) return -1;
                    return timeB - timeA; // Sort descending
                });

                // The first element after sorting is the latest valid one
                const latestData = trackerDataArray[0];
                updateTrackerPosition(latestData); // Update map and info panel
                if (!hasLoadedLocation) {
                    hideLoadingOverlay(); // Hide overlay on first successful load
                    hasLoadedLocation = true;
                }
            } else {
                // No location data found
                try {
                    const lastUpdateElement = document.getElementById('lastUpdate');
                    if (lastUpdateElement) lastUpdateElement.textContent = 'Last update: No location data available';
                    updateLocationStatus(false, 'No Data'); // Update status
                } catch (e) {
                    console.error('Failed to update no data status:', e);
                }
                if (!hasLoadedLocation) hideLoadingOverlay(); // Hide overlay even if no data
            }
        } catch (error) {
            handleApiError(error, `fetching tracker ${trackerId} location`);
            if (!hasLoadedLocation) hideLoadingOverlay(); // Hide overlay on error
        }
    }

    // Update location status display based on time and status text
    function updateLocationStatus(isActive, statusText = '') {
        try {
            const statusElement = document.getElementById('locationStatus');
            if (statusElement) {
                statusElement.textContent = `Status: ${statusText}`;
                statusElement.style.color = isActive ? 'green' : 'red';
            }
        } catch (e) {
            console.error('Failed to update location status:', e);
        }
    }


    // Function to update tracker position on map and info panel
    function updateTrackerPosition(data) {
        try {
            const { latitude, longitude, timestamp } = data; // Extract relevant data
            const speed = data.speed || 0; // Use speed if available, else 0

            // Validate coordinates
            if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                console.warn('Invalid coordinates received:', data);
                updateLocationStatus(false, 'Invalid Data');
                return;
            }

            const latLng = [latitude, longitude];

            // Update marker position if map and marker exist
            if (map && trackerMarker) {
                trackerMarker.setLatLng(latLng);
                trackerMarker.setPopupContent(`Tracker ${trackerId}<br>Updated: ${new Date(timestamp).toLocaleTimeString()}`).openPopup();
            }

            // Update info panel
            try {
                const speedElement = document.getElementById('busSpeed');
                 // Speed is not in the example API response, setting to N/A
                if (speedElement) speedElement.textContent = `Speed: N/A`;
            } catch (e) {
                console.error('Failed to update speed:', e);
            }

            const now = new Date();
            const updateTime = new Date(timestamp);
            const secondsAgo = Math.round((now - updateTime) / 1000);

            let timeText;
            let currentStatusText = 'Active'; // Assume active if we have valid data
            let isActive = true;

            if (isNaN(updateTime.getTime())) {
                timeText = 'Invalid timestamp';
                currentStatusText = 'Invalid Data';
                isActive = false;
                console.error("Location Status: Invalid timestamp parsed.", { timestamp: timestamp, parsedDate: updateTime });
            } else if (secondsAgo < 0) {
                 timeText = 'Timestamp in future?'; // Handle potential clock skew
                 currentStatusText = 'Time Sync Issue';
                 isActive = false; // Treat as inactive/error state
                 console.warn("Location Status: Timestamp is in the future.", { secondsAgo: secondsAgo, lastUpdate: updateTime.toISOString(), now: now.toISOString(), rawTimestamp: timestamp });
            } else if (secondsAgo < 60) {
                timeText = 'Just now';
            } else if (secondsAgo < 3600) { // Less than 1 hour
                timeText = `${Math.floor(secondsAgo / 60)} min ago`;
            } else { // Over 1 hour
                timeText = `${Math.floor(secondsAgo / 3600)} hours ago`;
            }
            
            // Log the update details if active
            if (isActive) {
                 console.log(`Location Status: Active. secondsAgo: ${secondsAgo}, Last Update: ${updateTime.toISOString()}, Now: ${now.toISOString()}, Raw Timestamp: ${timestamp}`);
            }

            try {
                const lastUpdateElement = document.getElementById('lastUpdate');
                if (lastUpdateElement) lastUpdateElement.textContent = `Last update: ${timeText}`;
            } catch (e) {
                console.error('Failed to update last update:', e);
            }

            // Update location status text and color
            updateLocationStatus(isActive, currentStatusText);


            // Center map on tracker position only on the first load or if explicitly requested
            if (map && !hasLoadedLocation) {
                map.setView(latLng, 15);
            }
        } catch (e) {
            console.error('Failed to update tracker position:', e);
            updateLocationStatus(false, 'Update Error');
        }
    }


     // Highlight active footer item
    window.highlight = function(element) {
      try {
        document.querySelectorAll(".footer-item").forEach(item => {
          item.classList.remove("active");
        });
        element.classList.add("active");
      } catch (e) {
        console.error('Failed to highlight element:', e);
      }
    };

     // Cleanup function
     function cleanup() {
        if (refreshInterval) clearInterval(refreshInterval);
        // No socket cleanup needed
    }

    // --- Initialization ---

    updateTrackerInfo(); // Update static info like header, tracker ID
    fetchTrackerLocation(); // Initial fetch for location

    // Set a timeout to hide loading overlay if fetching takes too long
    const loadingTimeout = setTimeout(() => {
        if (!hasLoadedLocation) {
            hideLoadingOverlay();
            console.warn('Loading timeout reached.');
             try {
                const lastUpdateElement = document.getElementById('lastUpdate');
                if (lastUpdateElement) lastUpdateElement.textContent = 'Last update: Loading timed out';
                updateLocationStatus(false, 'Timeout');
            } catch(e) { console.error("Error updating timeout status", e); }
        }
    }, 15000); // 15 seconds timeout

     // Periodically check for location updates
     refreshInterval = setInterval(() => {
        if (navigator.onLine) {
            fetchTrackerLocation();
        } else {
            console.warn('Offline - skipping location update');
            updateLocationStatus(false, 'Offline');
        }
    }, 10000); // Refresh every 10 seconds

     // Cleanup on page unload
     window.addEventListener('beforeunload', () => {
         cleanup();
         clearTimeout(loadingTimeout); // Clear timeout on unload
     });

  } catch (initError) {
    console.error('Application initialization failed:', initError);
    // Display error message to the user
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.innerHTML = '<p class="error">Failed to initialize application. Please refresh the page.</p>';
    }
    const loadingOverlayElement = document.querySelector('.loading-overlay');
    if (loadingOverlayElement) loadingOverlayElement.style.display = 'none';
  }
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initApplication);

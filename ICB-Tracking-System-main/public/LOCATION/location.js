// Wait for config to be loaded before initializing
document.addEventListener('app-config-loaded', initApplication);
document.addEventListener('app-config-error', initApplication);

// Fallback in case config events don't fire
setTimeout(initApplication, 2000);

function initApplication() {
  try {
    // Use the centralized config for API URL or fallback
    const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || "https://iot-tracker-api.vercel.app";
    // const FALLBACK_API_URL = "https://icb-tracking-website.vercel.app";
    
    // Get bus number from URL or default to ESP32_001
    const urlParams = new URLSearchParams(window.location.search);
    const busNumber = urlParams.get('bus') || 'ESP32_001';

    // Default coordinates for initial map view (center of Hyderabad)
    const defaultCoordinates = [17.3850, 78.4867];
    let hasLoadedLocation = false;
    let socket;
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
      document.getElementById('map').innerHTML = '<p class="error">Failed to load map. Please refresh the page.</p>';
    }

    // Custom bus icon
    const busIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/477/477103.png',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });

    // Create bus marker with default position
    let busMarker;
    if (map) {
      busMarker = L.marker(defaultCoordinates, { icon: busIcon }).addTo(map);
      busMarker.bindPopup(`Bus ${busNumber}`).openPopup();
    }

    // Add loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="spinner"></div><p>Loading bus location...</p>';
    document.body.appendChild(loadingOverlay);

    // Enhanced API fetch function with retry and fallback
    async function fetchApiData(endpoint, options = {}) {
      const urlsToTry = [
        `${API_BASE_URL}${endpoint}`,
        `${FALLBACK_API_URL}${endpoint}`
      ];

      for (const url of urlsToTry) {
        try {
          const response = await fetch(url, options);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return await response.json();
        } catch (error) {
          console.warn(`Attempt failed for ${url}:`, error);
          if (url === urlsToTry[urlsToTry.length - 1]) throw error; // Only throw if last attempt
        }
      }
    }

    // Initialize socket connection with robust error handling
    function initSocket() {
      try {
        if (window.APP_CONFIG?.createSocketConnection) {
          socket = window.APP_CONFIG.createSocketConnection();
          
          socket.on('connect', () => {
            console.log('Socket connected');
            socket.emit('joinBus', busNumber);
          });

          socket.on('disconnect', () => {
            console.warn('Socket disconnected');
          });

          socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
          });

          // Listen for real-time updates
          socket.on('busLocation', (data) => {
            if (data?.busNumber === busNumber) {
              updateBusPosition(data);
              hideLoadingOverlay();
            }
          });
        } else {
          console.warn('Socket connection not available - using mock');
          socket = {
            on: () => {},
            emit: () => {},
            disconnect: () => {},
            connected: false
          };
        }
      } catch (e) {
        console.error('Socket initialization failed:', e);
        socket = {
          on: () => {},
          emit: () => {},
          disconnect: () => {},
          connected: false
        };
      }
    }

    // Update header with bus number
    function updateBusInfo() {
      try {
        document.getElementById('busHeader').textContent = `🚌 Bus No ${busNumber}`;
        document.getElementById('busNumber').textContent = `Bus No: ${busNumber}`;
      } catch (e) {
        console.error('Failed to update bus info:', e);
      }
    }

    // Function to handle API errors
    function handleApiError(error) {
      console.error('API Error:', error);
      try {
        document.getElementById('busRoute').textContent = 'Route: Error loading data';
        document.getElementById('lastUpdate').textContent = 'Last update: Error';
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

    // Fetch bus data (route, contact, etc)
    async function fetchBusData() {
      try {
        const result = await fetchApiData(`/api/buses/${busNumber}`);
        
        if (result?.data?.bus) {
          const bus = result.data.bus;

          // Update contact info if available
          if (bus.contactNumber) {
            try {
              document.getElementById('callLink').href = `tel:${bus.contactNumber}`;
              document.getElementById('smsLink').href = `sms:${bus.contactNumber}`;
            } catch (e) {
              console.error('Failed to update contact links:', e);
            }
          }

          // Update route info
          if (bus.route) {
            try {
              document.getElementById('busRoute').textContent = `Route: ${bus.route}`;
            } catch (e) {
              console.error('Failed to update route:', e);
            }
          }

          // If bus has location data and we haven't loaded location yet, update the map immediately
          if (bus.latitude && bus.longitude && !hasLoadedLocation && map && busMarker) {
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
          updateLocationStatus(bus.latitude && bus.longitude);
        }
      } catch (error) {
        console.error('Error fetching bus data:', error);
        try {
          document.getElementById('busRoute').textContent = 'Route: Information not available';
        } catch (e) {
          console.error('Failed to update route error:', e);
        }
        updateLocationStatus(false);
        handleApiError(error);
      }
    }

    // Update location status display
    function updateLocationStatus(isActive) {
      try {
        const statusElement = document.getElementById('locationStatus');
        if (statusElement) {
          if (isActive) {
            statusElement.textContent = 'Location tracking is active.';
            statusElement.style.color = 'green';
          } else {
            statusElement.textContent = 'Location system offline';
            statusElement.style.color = 'red';
          }
        }
      } catch (e) {
        console.error('Failed to update location status:', e);
      }
    }

    // Fetch latest location data
    async function fetchLatestLocation() {
      try {
        // First try to get the bus data with location
        const result = await fetchApiData(`/api/buses/${busNumber}`);
        
        if (result?.data?.bus?.latitude && result.data.bus.longitude) {
          updateBusPosition({
            latitude: result.data.bus.latitude,
            longitude: result.data.bus.longitude,
            speed: 0,
            direction: 0,
            timestamp: result.data.bus.lastUpdated || new Date()
          });
          hideLoadingOverlay();
        } else {
          await fetchTrackerLocation();
        }
      } catch (error) {
        console.error('Error fetching bus location:', error);
        await fetchTrackerLocation();
      }
    }

    // Fetch tracker location as fallback
    async function fetchTrackerLocation() {
      try {
        const result = await fetchApiData(`/trackers/${busNumber}?limit=1`);
        
        if (result?.data?.trackers?.length > 0) {
          updateBusPosition(result.data.trackers[0]);
          hideLoadingOverlay();
        } else {
          try {
            document.getElementById('lastUpdate').textContent = 'Last update: Waiting for first signal';
          } catch (e) {
            console.error('Failed to update last update text:', e);
          }
          hideLoadingOverlay();
        }
      } catch (error) {
        console.error('Error fetching tracker location:', error);
        try {
          document.getElementById('lastUpdate').textContent = 'Last update: Signal lost';
        } catch (e) {
          console.error('Failed to update signal lost text:', e);
        }
        hideLoadingOverlay();
      }
    }

    // Function to update bus position on map
    function updateBusPosition(data) {
      try {
        const { latitude, longitude, speed, direction, timestamp } = data;

        // Update marker position if map and marker exist
        if (map && busMarker) {
          busMarker.setLatLng([latitude, longitude]);
        }

        // Update info panel
        try {
          document.getElementById('busSpeed').textContent = `Speed: ${speed ? speed.toFixed(1) + ' km/h' : 'N/A'}`;
        } catch (e) {
          console.error('Failed to update speed:', e);
        }

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

        try {
          document.getElementById('lastUpdate').textContent = `Last update: ${timeText}`;
        } catch (e) {
          console.error('Failed to update last update:', e);
        }

        // Update location status based on recency
        try {
          const statusElement = document.getElementById('locationStatus');
          if (statusElement) {
            if (secondsAgo < 300) {
              statusElement.textContent = 'Location tracking is active.';
              statusElement.style.color = 'green';
            } else if (secondsAgo < 900) {
              statusElement.textContent = 'Location signal delayed.';
              statusElement.style.color = 'orange';
            } else {
              statusElement.textContent = 'Location signal lost.';
              statusElement.style.color = 'red';
            }
          }
        } catch (e) {
          console.error('Failed to update location status:', e);
        }

        // Center map on bus position if map exists
        if (map) {
          map.setView([latitude, longitude], 15);
        }
        hasLoadedLocation = true;
      } catch (e) {
        console.error('Failed to update bus position:', e);
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
      if (socket?.connected) socket.disconnect();
    }

    // Initialize socket and start data fetching
    initSocket();
    updateBusInfo();
    fetchBusData();
    fetchLatestLocation();

    // Set a timeout to hide loading overlay even if we can't get location
    setTimeout(hideLoadingOverlay, 10000);

    // Periodically check for location updates with network check
    refreshInterval = setInterval(() => {
      if (navigator.onLine) {
        fetchLatestLocation();
      } else {
        console.warn('Offline - skipping location update');
        try {
          document.getElementById('locationStatus').textContent = 'Offline - no updates';
          document.getElementById('locationStatus').style.color = 'red';
        } catch (e) {
          console.error('Failed to update offline status:', e);
        }
      }
    }, 10000);

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

  } catch (initError) {
    console.error('Application initialization failed:', initError);
    try {
      document.getElementById('map').innerHTML = '<p class="error">Failed to initialize application. Please refresh the page.</p>';
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    } catch (e) {
      console.error('Failed to display initialization error:', e);
    }
  }
}

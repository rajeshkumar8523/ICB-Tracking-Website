// Use the centralized config for API URL with better fallback
let API_BASE_URL;
try {
  // Check if config exists and is properly loaded
  if (typeof window.APP_CONFIG === 'object' && window.APP_CONFIG.API_BASE_URL) {
    API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
    console.log('Using API URL from config:', API_BASE_URL);
  } else {
    // Fallback if config not available
    API_BASE_URL = 'https://icb-tracking-website.vercel.app';
    console.log('Using fallback API URL:', API_BASE_URL);
  }
} catch (e) {
  // Emergency fallback
  API_BASE_URL = 'https://icb-tracking-website.vercel.app';
  console.error('Error loading config:', e);
}

let socket;
let socketConnected = false;

// Initialize socket if not in guest mode
function initializeSocket() {
    // Check if we're in guest mode
    const isGuestMode = localStorage.getItem('guestMode') === 'true';
    
    if (isGuestMode) {
        console.log('Guest mode active - skipping socket connection');
        return;
    }
    
    // Check if socket.io is available
    if (typeof io === 'undefined') {
        console.error('Socket.io library not available');
        return;
    }
    
    try {
        // Close existing socket if any
        if (socket) {
            socket.disconnect();
        }
        
        // Direct socket connection without relying on config.js
        console.log('Connecting to socket at:', API_BASE_URL);
        socket = io(API_BASE_URL, {
            path: '/socket.io',
            reconnectionAttempts: 5,
            timeout: 20000,
            transports: ['polling', 'websocket'],
            forceNew: true,
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000
        });
        
        if (!socket) {
            console.error('Failed to create socket connection');
            return;
        }
        
        // Socket event handlers
        socket.on('connect', () => {
            console.log('Socket connected successfully');
            socketConnected = true;
            showUpdateNotification('Connected to live updates');
        });
        
        // Listen for real-time bus location updates
        socket.on('busLocation', (data) => {
            showUpdateNotification(`Bus ${data.busNumber} location updated just now`);
            console.log('Received location update for bus:', data.busNumber);
            // Refresh bus list when we get an update
            fetchAndRenderBuses();
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            socketConnected = false;
            // Don't show this error to user - just log it
        });
        
        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            socketConnected = false;
            
            // Attempt to reconnect if not intentionally disconnected
            if (reason === 'io server disconnect') {
                // The server has forcefully disconnected the socket
                setTimeout(() => {
                    console.log('Attempting to reconnect socket...');
                    socket.connect();
                }, 5000);
            }
        });
        
        socket.on('error', (error) => {
            console.error('Socket error:', error);
            socketConnected = false;
        });
    } catch (e) {
        console.error('Failed to initialize socket:', e);
        socketConnected = false;
    }
}

// Function to show update notification
function showUpdateNotification(message) {
    const notification = document.getElementById('updateNotification');
    const updateTime = document.getElementById('updateTime');
    
    if (!notification || !updateTime) {
        console.error('Notification elements not found');
        return;
    }

    updateTime.textContent = message;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Highlight active footer item
function highlight(element) {
    document.querySelectorAll(".footer-item").forEach(item => {
        item.classList.remove("active");
    });
    element.classList.add("active");
}

// Function to fetch and render buses
async function fetchAndRenderBuses() {
    try {
        const container = document.getElementById('busContainer');
        if (!container) {
            console.error('Bus container element not found');
            return;
        }
        
        container.innerHTML = '<div class="loading">Loading buses...</div>'; // Show loading
        
        // Check if we're in guest mode
        const isGuestMode = localStorage.getItem('guestMode') === 'true';
        console.log("Guest mode:", isGuestMode);
        
        let buses = [];
        
        if (isGuestMode) {
            // Use mock data for guest mode
            buses = [
                { busNumber: "01", route: "COLLEGE TO JADCHERLA", currentStatus: "active", contactNumber: "+917981321536" },
                { busNumber: "02", route: "COLLEGE TO KOTHAKOTA", currentStatus: "active", contactNumber: "+917981321537" },
                { busNumber: "03", route: "COLLEGE TO METTUGADA", currentStatus: "inactive", contactNumber: "+917981321538" }
            ];
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            // Fetch real data from API with timeout
            try {
                console.log("Fetching buses from:", `${API_BASE_URL}/api/buses`);
                
                // Create AbortController for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                const response = await fetch(`${API_BASE_URL}/api/buses`, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId); // Clear timeout
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                buses = result.data?.buses || [];
                
                // If socket is not connected, check for recent updates
                if (!socketConnected && !isGuestMode) {
                    console.log("Socket not connected, checking for bus updates via API");
                    try {
                        // Get the last update time or default to 5 minutes ago
                        const lastUpdateTime = localStorage.getItem('lastUpdateTime') || 
                            new Date(Date.now() - 5 * 60 * 1000).toISOString();
                        
                        const updatesResponse = await fetch(
                            `${API_BASE_URL}/api/bus-updates?since=${encodeURIComponent(lastUpdateTime)}`, 
                            { signal: controller.signal }
                        );
                        
                        if (updatesResponse.ok) {
                            const updatesData = await updatesResponse.json();
                            console.log("Received updates via API:", updatesData);
                            
                            // Store the current time as last update time
                            localStorage.setItem('lastUpdateTime', new Date().toISOString());
                            
                            // If we got updates, update the buses data
                            if (updatesData.data && updatesData.data.updates && updatesData.data.updates.length > 0) {
                                // Update bus locations if needed
                                buses = buses.map(bus => {
                                    // Find the latest update for this bus
                                    const latestUpdate = updatesData.data.updates.find(u => u.busNumber === bus.busNumber);
                                    if (latestUpdate) {
                                        // Update bus with latest location
                                        return {
                                            ...bus,
                                            latitude: latestUpdate.latitude,
                                            longitude: latestUpdate.longitude,
                                            lastUpdated: latestUpdate.timestamp
                                        };
                                    }
                                    return bus;
                                });
                                
                                showUpdateNotification(`Updates received at: ${new Date().toLocaleTimeString()}`);
                            }
                        }
                    } catch (updateError) {
                        console.warn("Failed to get updates via API:", updateError);
                    }
                }
            } catch (apiError) {
                console.error('API error:', apiError);
                if (apiError.name === 'AbortError') {
                    // Handle timeout specifically
                    console.log('Request timed out, using fallback data');
                    buses = [
                        { busNumber: "01", route: "COLLEGE TO JADCHERLA", currentStatus: "unknown", contactNumber: "+917981321536" },
                        { busNumber: "02", route: "COLLEGE TO KOTHAKOTA", currentStatus: "unknown", contactNumber: "+917981321537" }
                    ];
                } else {
                    throw apiError;
                }
            }
        }

        container.innerHTML = ''; // Clear loading message

        if (buses.length) {
            buses.forEach(bus => {
                // Determine status class
                const statusClass = bus.currentStatus === 'active' ? 'status-green' : 
                                   bus.currentStatus === 'inactive' ? 'status-red' : 'status-yellow';
                
                // Format the route
                let routeDisplay = bus.route;
                // Check if the route contains "COLLEGE TO" or similar format
                if (bus.route.includes("COLLEGE TO")) {
                    routeDisplay = bus.route.split("COLLEGE TO")[1].trim();
                } else if (bus.route.includes("College to")) {
                    routeDisplay = bus.route.split("College to")[1].trim();
                } else if (bus.route.includes("TO")) {
                    routeDisplay = bus.route.split("TO")[1].trim();
                } else if (bus.route.includes("to")) {
                    routeDisplay = bus.route.split("to")[1].trim();
                }
                
                // Create bus card
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="status-bar ${statusClass}"></div>
                    <div class="bus-number">BUS NO-${bus.busNumber}</div> 
                    <div class="route">
                        COLLEGE <br> <SMALL>TO</SMALL><br> ${routeDisplay}
                    </div>
                    <div class="icons">
                        <a href="tel:${bus.contactNumber || '+1234567890'}">
                            <i class="fas fa-phone"></i>
                        </a>
                        <a href="../LOCATION/location.html?bus=${bus.busNumber}" class="location-link">
                            <i class="fas fa-map-marker-alt"></i>
                        </a>
                    </div>
                `;
                container.appendChild(card);
            });

            // Show update notification
            const updateType = socketConnected ? 'Live update' : 'Last update';
            showUpdateNotification(`${updateType}: ${new Date().toLocaleTimeString()}`);
        } else {
            // Handle empty bus list
            container.innerHTML = '<div class="no-buses">No buses available</div>';
        }
    } catch (error) {
        console.error('Error fetching buses:', error);
        const container = document.getElementById('busContainer');
        container.innerHTML = `
            <div class="error">Failed to load bus data. Please try again later.</div>
            <button onclick="fetchAndRenderBuses()" class="retry-button">Retry</button>
        `;
        showUpdateNotification('Error updating');
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const userId = localStorage.getItem('userId');
    const isGuestMode = localStorage.getItem('guestMode') === 'true';
    
    if (!userId && !isGuestMode) {
        // Redirect to login if not logged in and not in guest mode
        window.location.href = '../STUDENTLOGIN/studentlogin.html';
        return;
    }
    
    // Initialize the socket connection
    initializeSocket();
    
    // Fetch buses immediately
    fetchAndRenderBuses();
    
    // Set up refresh intervals
    // More frequent polling if socket is not connected
    setInterval(() => {
        if (!socketConnected && !localStorage.getItem('guestMode') === 'true') {
            console.log("Socket not connected, using HTTP polling instead");
            fetchAndRenderBuses();
        }
    }, 30000); // Poll every 30 seconds if socket is down
    
    // Less frequent background refresh regardless of socket status
    setInterval(fetchAndRenderBuses, 120000); // Every 2 minutes
});

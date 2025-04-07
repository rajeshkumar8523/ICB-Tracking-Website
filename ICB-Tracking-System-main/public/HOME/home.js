// Get the API base URL with improved error handling
let API_BASE_URL = 'https://icb-tracking-website.vercel.app'; // Default fallback

try {
    // Check if APP_CONFIG exists and has API_BASE_URL
    if (window.APP_CONFIG && typeof window.APP_CONFIG.API_BASE_URL === 'string') {
        API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
        console.log('Using API URL from config:', API_BASE_URL);
    } else {
        console.warn('APP_CONFIG not found or invalid, using default API URL:', API_BASE_URL);
    }
} catch (e) {
    console.error('Error accessing APP_CONFIG:', e);
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
        showUpdateNotification('Live updates not available');
        return;
    }
    
    try {
        // Close existing socket if any
        if (socket) {
            socket.disconnect();
        }
        
        // Create new socket connection
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
        
        container.innerHTML = '<div class="loading">Loading buses...</div>';
        
        const isGuestMode = localStorage.getItem('guestMode') === 'true';
        console.log("Guest mode:", isGuestMode);
        
        let buses = [];
        let apiEndpoint = `${API_BASE_URL}/api/buses`;
        
        if (isGuestMode) {
            apiEndpoint = `${API_BASE_URL}/api/public/buses`;
        }
        
        try {
            console.log("Fetching buses from:", apiEndpoint);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(apiEndpoint, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Response was not JSON');
            }
            
            const result = await response.json();
            buses = result.data?.buses || [];
            
            if (!socketConnected && !isGuestMode) {
                try {
                    const lastUpdateTime = localStorage.getItem('lastUpdateTime') || 
                        new Date(Date.now() - 5 * 60 * 1000).toISOString();
                    
                    const updatesResponse = await fetch(
                        `${API_BASE_URL}/api/bus-updates?since=${encodeURIComponent(lastUpdateTime)}`,
                        {
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    if (updatesResponse.ok) {
                        const updatesData = await updatesResponse.json();
                        if (updatesData.data?.updates?.length > 0) {
                            buses = buses.map(bus => {
                                const latestUpdate = updatesData.data.updates.find(u => u.busNumber === bus.busNumber);
                                if (latestUpdate) {
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
            throw new Error('Failed to fetch bus data from server');
        }

        container.innerHTML = '';

        if (buses.length) {
            buses.forEach(bus => {
                const statusClass = bus.currentStatus === 'active' ? 'status-green' : 
                                   bus.currentStatus === 'inactive' ? 'status-red' : 'status-yellow';
                
                let routeDisplay = bus.route;
                if (bus.route.includes("COLLEGE TO")) {
                    routeDisplay = bus.route.split("COLLEGE TO")[1].trim();
                } else if (bus.route.includes("College to")) {
                    routeDisplay = bus.route.split("College to")[1].trim();
                } else if (bus.route.includes("TO")) {
                    routeDisplay = bus.route.split("TO")[1].trim();
                } else if (bus.route.includes("to")) {
                    routeDisplay = bus.route.split("to")[1].trim();
                }
                
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

            const updateType = socketConnected ? 'Live update' : 'Last update';
            showUpdateNotification(`${updateType}: ${new Date().toLocaleTimeString()}`);
        } else {
            container.innerHTML = '<div class="no-buses">No buses available</div>';
        }
    } catch (error) {
        console.error('Error fetching buses:', error);
        const container = document.getElementById('busContainer');
        if (container) {
            container.innerHTML = `
                <div class="error">Failed to load bus data. Please try again later.</div>
                <button onclick="fetchAndRenderBuses()" class="retry-button">Retry</button>
            `;
        }
        showUpdateNotification('Error updating');
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in or in guest mode
    const userId = localStorage.getItem('userId');
    const isGuestMode = localStorage.getItem('guestMode') === 'true';
    
    if (!userId && !isGuestMode) {
        // Redirect to login if not logged in and not in guest mode
        window.location.href = '../STUDENTLOGIN/studentlogin.html';
        return;
    }
    
    // Add a guest mode indicator if in guest mode
    if (isGuestMode) {
        const header = document.querySelector('header');
        if (header) {
            const guestIndicator = document.createElement('div');
            guestIndicator.className = 'guest-indicator';
            guestIndicator.innerHTML = '<i class="fas fa-user-secret"></i> Guest Mode';
            header.appendChild(guestIndicator);
        }
    } else {
        // Only initialize the socket connection if not in guest mode
        initializeSocket();
    }
    
    // Fetch buses immediately
    fetchAndRenderBuses();
    
    // Set up refresh intervals
    // More frequent polling if socket is not connected
    setInterval(() => {
        if (!socketConnected && !isGuestMode) {
            console.log("Socket not connected, using HTTP polling instead");
            fetchAndRenderBuses();
        }
    }, 30000); // Poll every 30 seconds if socket is down
    
    // Less frequent background refresh regardless of socket status
    setInterval(fetchAndRenderBuses, 120000); // Every 2 minutes
});

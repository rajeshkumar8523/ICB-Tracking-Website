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
            console.log('Received location update:', data);
            updateBusLocation(data);
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

// Function to update bus location
function updateBusLocation(data) {
    const busCard = document.querySelector(`.card[data-bus-number="${data.busNumber}"]`);
    if (busCard) {
        const statusBar = busCard.querySelector('.status-bar');
        statusBar.className = `status-bar ${data.currentStatus === 'active' ? 'status-green' : 'status-red'}`;
        showUpdateNotification(`Bus ${data.busNumber} location updated`);
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
        const isGuestMode = !localStorage.getItem('token');
        const apiUrl = isGuestMode ? 
            `${window.APP_CONFIG.API_BASE_URL}${window.APP_CONFIG.ENDPOINTS.PUBLIC_BUSES}` : 
            `${window.APP_CONFIG.API_BASE_URL}${window.APP_CONFIG.ENDPOINTS.BUSES}`;

        console.log('Fetching buses from:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...(isGuestMode ? {} : {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                })
            },
            credentials: 'include' // Include cookies if any
        });

        // Log the response status and headers
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseText = await response.text();
            console.error('Non-JSON response:', responseText);
            throw new Error(`Expected JSON but got ${contentType}`);
        }

        const data = await response.json();
        console.log('Received data:', data);
        
        if (!data || !data.data || !data.data.buses) {
            throw new Error('Invalid response format: missing buses data');
        }

        const busesContainer = document.getElementById('busContainer');
        if (!busesContainer) {
            throw new Error('Buses container not found');
        }

        busesContainer.innerHTML = '';

        if (data.data.buses.length === 0) {
            busesContainer.innerHTML = '<div class="no-buses">No buses available</div>';
            return;
        }

        data.data.buses.forEach(bus => {
            const busCard = document.createElement('div');
            busCard.className = 'card';
            busCard.setAttribute('data-bus-number', bus.busNumber);
            busCard.innerHTML = `
                <div class="status-bar ${bus.currentStatus === 'active' ? 'status-green' : 'status-red'}"></div>
                <div class="bus-number">BUS NO-${bus.busNumber}</div>
                <div class="route">
                    COLLEGE <br> <SMALL>TO</SMALL><br> ${bus.route.split('TO')[1]?.trim() || bus.route}
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
            busesContainer.appendChild(busCard);
        });

        // Update socket connection for real-time updates
        if (socket) {
            socket.disconnect();
        }

        socket = window.APP_CONFIG.createSocketConnection();

        if (socket) {
            socket.on('connect', () => {
                console.log('Connected to WebSocket server');
                showUpdateNotification('Connected to real-time updates');
            });

            socket.on('busLocation', (data) => {
                console.log('Received location update:', data);
                updateBusLocation(data);
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from WebSocket server');
                showUpdateNotification('Disconnected from real-time updates');
            });

            socket.on('error', (error) => {
                console.error('Socket error:', error);
                showUpdateNotification('Error in real-time updates');
            });
        }

    } catch (error) {
        console.error('Error fetching buses:', error);
        const busesContainer = document.getElementById('busContainer');
        if (busesContainer) {
            busesContainer.innerHTML = `
                <div class="error-message">
                    <p>Failed to load bus data: ${error.message}</p>
                    <button onclick="fetchAndRenderBuses()">Retry</button>
                </div>
            `;
        }
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
    setInterval(() => {
        if (!socketConnected && !isGuestMode) {
            fetchAndRenderBuses();
        }
    }, 30000); // Poll every 30 seconds if socket is down
    
    setInterval(fetchAndRenderBuses, 120000); // Every 2 minutes
});

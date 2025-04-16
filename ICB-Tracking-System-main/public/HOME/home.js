// Configuration
const API_BASE_URL = 'https://icb-tracking-website.vercel.app';
const FALLBACK_API_URL = 'https://iot-tracker-api.vercel.app';
const socket = io(API_BASE_URL);

// Function to show update notification
function showUpdateNotification(message) {
    const notification = document.getElementById('updateNotification');
    const updateTime = document.getElementById('updateTime');

    if (notification && updateTime) {
        updateTime.textContent = message;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

// Highlight active footer item
function highlight(element) {
    if (element) {
        document.querySelectorAll(".footer-item").forEach(item => {
            item.classList.remove("active");
        });
        element.classList.add("active");
    }
}

// Improved API fetch with error handling
async function fetchWithFallback(url, options = {}) {
    try {
        // Try primary API
        const response = await fetch(`${API_BASE_URL}${url}`, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (primaryError) {
        console.warn(`Primary API failed (${url}), trying fallback:`, primaryError);
        
        try {
            // Try fallback API
            const fallbackResponse = await fetch(`${FALLBACK_API_URL}${url}`, options);
            if (!fallbackResponse.ok) throw new Error(`Fallback HTTP error! status: ${fallbackResponse.status}`);
            return await fallbackResponse.json();
        } catch (fallbackError) {
            console.error(`Both API endpoints failed for ${url}:`, fallbackError);
            throw fallbackError;
        }
    }
}

// Function to fetch and display all buses with robust error handling
async function fetchAndRenderBuses() {
    const container = document.getElementById('busContainer');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading">Loading buses...</div>';
        
        const result = await fetchWithFallback('/api/buses');
        const buses = result?.data?.buses || [];

        if (buses.length === 0) {
            container.innerHTML = '<div class="no-buses">No buses available</div>';
            showUpdateNotification('No buses found');
            return;
        }

        container.innerHTML = ''; // Clear loading message

        buses.forEach(bus => {
            // Validate bus data
            if (!bus.busNumber) {
                console.warn('Skipping invalid bus data:', bus);
                return;
            }

            // Determine status class with fallback
            const status = bus.currentStatus?.toLowerCase() || 'unknown';
            const statusClass = 
                status === 'active' ? 'status-green' : 
                status === 'inactive' ? 'status-red' : 'status-yellow';
            
            // Format the route with fallback
            let routeDisplay = bus.route || 'Unknown Route';
            const separator = bus.route.match(/TO|to|COLLEGE TO|College to/i);
            if (separator) {
                routeDisplay = bus.route.split(separator[0])[1].trim();
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

        showUpdateNotification('Updated just now');
    } catch (error) {
        console.error('Error fetching buses:', error);
        container.innerHTML = `
            <div class="error">
                <p>Failed to load bus data.</p>
                <button onclick="fetchAndRenderBuses()">Retry</button>
            </div>
        `;
        showUpdateNotification('Update failed');
    }
}

// Socket.io with error handling
if (socket) {
    socket.on('connect', () => {
        console.log('Connected to real-time updates');
    });

    socket.on('disconnect', () => {
        console.warn('Disconnected from real-time updates');
    });

    socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        showUpdateNotification('Realtime connection lost');
    });

    socket.on('busLocation', (data) => {
        if (data?.busNumber) {
            showUpdateNotification(`${data.busNumber} updated`);
        }
    });
} else {
    console.warn('Socket.io not available');
}

// Initialize the page with retry logic
function initializePage() {
    try {
        fetchAndRenderBuses();
        
        // Refresh bus list every 30 seconds with health check
        const refreshInterval = setInterval(() => {
            if (navigator.onLine) {
                fetchAndRenderBuses();
            } else {
                console.warn('Offline - skipping refresh');
                showUpdateNotification('Offline - reconnect to update');
            }
        }, 30000);

        // Cleanup on page navigation
        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterval);
            if (socket) socket.disconnect();
        });
    } catch (initError) {
        console.error('Page initialization failed:', initError);
        document.getElementById('busContainer').innerHTML = `
            <div class="error">
                <p>Failed to initialize application.</p>
                <button onclick="initializePage()">Retry</button>
            </div>
        `;
    }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', initializePage);

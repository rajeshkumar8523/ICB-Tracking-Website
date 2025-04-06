// Use the centralized config for API URL
const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'https://icb-tracking-website.vercel.app';
let socket;

// Initialize socket if not in guest mode
try {
    socket = io(API_BASE_URL);
    
    // Listen for real-time bus location updates
    socket.on('busLocation', (data) => {
        showUpdateNotification(`just now`);
        console.log('Received location update for bus:', data.busNumber);
    });
    
    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
    });
} catch (e) {
    console.error('Failed to initialize socket:', e);
}

// Function to show update notification
function showUpdateNotification(message) {
    const notification = document.getElementById('updateNotification');
    const updateTime = document.getElementById('updateTime');

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

// Function to fetch and display all buses
async function fetchAndRenderBuses() {
    try {
        const container = document.getElementById('busContainer');
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
        } else {
            // Fetch real data from API
            try {
                console.log("Fetching buses from:", `${API_BASE_URL}/api/buses`);
                const response = await fetch(`${API_BASE_URL}/api/buses`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const result = await response.json();
                buses = result.data?.buses || [];
            } catch (apiError) {
                console.error('API error:', apiError);
                throw apiError;
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
            showUpdateNotification('just now');
        } else {
            // Handle empty bus list
            container.innerHTML = '<div class="no-buses">No buses available</div>';
        }
    } catch (error) {
        console.error('Error fetching buses:', error);
        const container = document.getElementById('busContainer');
        container.innerHTML = '<div class="error">Failed to load bus data. Please try again later.</div>';
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
    
    fetchAndRenderBuses();
    
    // Refresh bus list every 30 seconds
    setInterval(fetchAndRenderBuses, 30000);
});

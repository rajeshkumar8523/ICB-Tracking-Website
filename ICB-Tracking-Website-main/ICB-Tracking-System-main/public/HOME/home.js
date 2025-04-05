// Manually set the server URL
const API_BASE_URL = 'https://icb-tracking-website.vercel.app';
const socket = io(API_BASE_URL);

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
        const response = await fetch(`${API_BASE_URL}/api/buses`);
        const result = await response.json();

        // Extract the buses array from the response
        const buses = result.data?.buses || [];

        const container = document.getElementById('busContainer');
        container.innerHTML = ''; // Clear existing content

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
        container.innerHTML = '<div class="error">Failed to load bus data. Please try again later.</div>';
        showUpdateNotification('Error updating');
    }
}

// Listen for real-time bus location updates
socket.on('busLocation', (data) => {
    showUpdateNotification(`just now`);
});

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderBuses();
    
    // Refresh bus list every 30 seconds
    setInterval(fetchAndRenderBuses, 30000);
});

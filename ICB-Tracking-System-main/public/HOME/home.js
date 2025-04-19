// Configuration
const API_BASE_URL = 'https://iot-tracker-api.vercel.app'; // Use the new API base URL

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

// Simple API fetch function
async function fetchApiData(url, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${url}`, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`API fetch failed for ${url}:`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}


// Function to fetch and display tracker data
async function fetchAndRenderTracker() {
    const container = document.getElementById('busContainer');
    if (!container) return;

    // Hardcoded tracker ID based on the provided endpoint
    const trackerId = 'ESP32_001'; 

    try {
        container.innerHTML = '<div class="loading">Loading tracker data...</div>';
        
        // Fetch data for the specific tracker
        // The API returns an array of location points, we'll use the latest one (first in the array)
        const trackerDataArray = await fetchApiData(`/trackers/${trackerId}`); 

        if (!trackerDataArray || trackerDataArray.length === 0) {
            container.innerHTML = `<div class="no-buses">No data available for tracker ${trackerId}</div>`;
            showUpdateNotification(`No data for ${trackerId}`);
            return;
        }

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
        const deviceId = latestData.deviceId || trackerId; // Use deviceId from data or the requested ID

        container.innerHTML = ''; // Clear loading message

        // Determine status: Active if API call successful and data exists
        const lastUpdate = new Date(latestData.timestamp);
        let statusClass = 'status-green'; // Assume active if data is present
        let statusText = 'Active';

        // Check if the timestamp is valid
        if (isNaN(lastUpdate.getTime())) {
            console.error("Error parsing timestamp:", latestData.timestamp);
            statusClass = 'status-red'; // Mark as inactive/error if timestamp is invalid
            statusText = 'Invalid Time';
        } else {
             // Log the latest update time
             console.log(`Home Status: Active. Last Update: ${lastUpdate.toISOString()}, Raw Timestamp: ${latestData.timestamp}`);
        }

        // Create tracker card
        const card = document.createElement('div');
        card.className = 'card';
        // Note: Route and Contact info are not available from the new API
        card.innerHTML = `
            <div class="status-bar ${statusClass}"></div>
            <div class="bus-number">TRACKER-${deviceId}</div>
            <div class="route">
                Status: ${statusText}<br>
                <small>Last Update: ${isNaN(lastUpdate.getTime()) ? 'N/A' : lastUpdate.toLocaleString()}</small>
            </div>
            <div class="icons">

                <a href="../LOCATION/location.html?bus=${deviceId}" class="location-link">
                    <i class="fas fa-map-marker-alt"></i>
                </a>
            </div>
        `;
        container.appendChild(card);
        

        showUpdateNotification('Updated just now');
    } catch (error) {
        console.error(`Error fetching tracker ${trackerId}:`, error);
        container.innerHTML = `
            <div class="error">
                <p>Failed to load tracker data.</p>
                <button onclick="fetchAndRenderTracker()">Retry</button> 
            </div>
        `;
        showUpdateNotification('Update failed');
    }
}


// Initialize the page
function initializePage() {
    try {
        fetchAndRenderTracker(); // Call the new function
        
        // Refresh tracker data every 30 seconds
        const refreshInterval = setInterval(() => {
            if (navigator.onLine) {
                fetchAndRenderTracker();
            } else {
                console.warn('Offline - skipping refresh');
                showUpdateNotification('Offline - reconnect to update');
            }
        }, 30000); // Refresh every 30 seconds

        // Cleanup on page navigation
        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterval);
            // No socket to disconnect
        });
    } catch (initError) {
        console.error('Page initialization failed:', initError);
        const container = document.getElementById('busContainer');
        if (container) {
            container.innerHTML = `
            <div class="error">
                <p>Failed to initialize application.</p>
                <button onclick="initializePage()">Retry</button>
            </div>
            `;
        }
    }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', initializePage);

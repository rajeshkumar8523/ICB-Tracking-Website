// Function to get today's date and display it
function displayTodayDate() {
    let today = new Date();
    let options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let formattedDate = today.toLocaleDateString('en-US', options);
    document.getElementById('today-date').textContent = "Today - " + formattedDate;
}

displayTodayDate();

// Initialize Socket.IO connection
document.addEventListener('app-config-loaded', () => {
    const socket = window.APP_CONFIG.createSocketConnection();

    if (socket) {
        console.log('[notification.js] Socket.IO connected successfully');

        // Listen for real-time notifications
        socket.on('newNotification', (data) => {
            const notificationContainer = document.getElementById('real-time-notifications');

            // Create a new notification card
            const notificationCard = document.createElement('div');
            notificationCard.classList.add('notification-card', 'green-border');

            const notificationLeft = document.createElement('div');
            notificationLeft.classList.add('notification-left');

            const icon = document.createElement('i');
            icon.classList.add('fa-solid', 'fa-bell', 'notification-icon');

            const text = document.createElement('span');
            text.classList.add('notification-text');
            text.textContent = data.message;

            notificationLeft.appendChild(icon);
            notificationLeft.appendChild(text);

            const time = document.createElement('span');
            time.classList.add('notification-time');
            time.textContent = 'Just now';

            notificationCard.appendChild(notificationLeft);
            notificationCard.appendChild(time);

            // Prepend the new notification to the container
            notificationContainer.prepend(notificationCard);
        });

        // Handle socket errors
        socket.on('connect_error', (err) => {
            console.error('[notification.js] Socket connection error:', err);
        });
    } else {
        console.error('[notification.js] Failed to establish Socket.IO connection');
    }
});

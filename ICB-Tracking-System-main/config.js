// Configuration file for API endpoints and application settings
(function() {
  // Initialize APP_CONFIG immediately
  window.APP_CONFIG = window.APP_CONFIG || {
    API_BASE_URL: 'https://iot-tracker-api.vercel.app',
    featureFlags: { socketEnabled: false },
    createSocketConnection: function() {
      return {
        on: () => {},
        emit: () => {},
        disconnect: () => {}
      };
    }
  };

  try {
    // Detect environment
    const hostname = window.location.hostname;
    let API_BASE_URL = 'https://iot-tracker-api.vercel.app';
    let environment = 'production';

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      API_BASE_URL = 'http://localhost:3000';
      environment = 'development';
    }

    // Socket.io configuration
    const socketConfig = {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 10000,
      forceNew: true,
      autoConnect: true,
      withCredentials: false,
      query: { "client": "web", "version": "1.0.0" }
    };

    // Update APP_CONFIG
    Object.assign(window.APP_CONFIG, {
      API_BASE_URL,
      environment,
      version: '1.0.0',
      allowGuestMode: true,
      allowDemoMode: true,
      socketConfig,
      featureFlags: { socketEnabled: true, offline: false },
      
      createSocketConnection: function() {
        if (typeof io === 'undefined') {
          console.error('Socket.io not loaded');
          this.featureFlags.socketEnabled = false;
          return {
            on: () => {},
            emit: () => {},
            disconnect: () => {}
          };
        }

        try {
          const socket = io(this.API_BASE_URL, this.socketConfig);
          socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
            this.featureFlags.socketEnabled = false;
          });
          return socket;
        } catch (e) {
          console.error('Failed to create socket:', e);
          return {
            on: () => {},
            emit: () => {},
            disconnect: () => {}
          };
        }
      },
      
      isOffline: function() {
        return !navigator.onLine || this.featureFlags.offline;
      }
    });

    // Dispatch loaded event
    document.dispatchEvent(new CustomEvent('app-config-loaded', {
      detail: { config: window.APP_CONFIG }
    }));

  } catch (error) {
    console.error('Error in config:', error);
    document.dispatchEvent(new CustomEvent('app-config-error', {
      detail: { error: error.message }
    }));
  }
})();

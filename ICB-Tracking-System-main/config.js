// Configuration file for API endpoints and application settings
(function() {
  try {
    // Detect environment - This can be used for automatic environment switching
    const hostname = window.location.hostname;

    // Default to production (Vercel deployment)
    let API_BASE_URL = 'https://iot-tracker-api.vercel.app';
    let environment = 'production';

    // If running locally, use localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      API_BASE_URL = 'http://localhost:3000';
      environment = 'development';
    }

    console.log(`[config.js] Environment: ${environment}`);
    console.log(`[config.js] Using API URL: ${API_BASE_URL}`);

    // Socket.io configuration - simplified for Vercel
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
      query: {
        "client": "web",
        "version": "1.0.0"
      }
    };

    // Store configuration in global variable
    window.APP_CONFIG = {
      API_BASE_URL,
      environment,
      version: '1.0.0',
      allowGuestMode: true,
      allowDemoMode: true,
      socketConfig,
      featureFlags: {
        socketEnabled: true,
        offline: false
      },
      
      // Modified createSocketConnection to be more defensive
      createSocketConnection: function() {
        // Check if io is available
        if (typeof io === 'undefined') {
          console.error('[config.js] Socket.io not loaded. Make sure to include socket.io.js before this file.');
          this.featureFlags.socketEnabled = false;
          return {
            on: () => {},
            emit: () => {},
            disconnect: () => {}
          }; // Return mock socket object
        }

        try {
          const socket = io(this.API_BASE_URL, this.socketConfig);

          socket.on('connect_error', (err) => {
            console.error('[config.js] Socket connection error:', err);
            if (this.environment === 'production') {
              this.featureFlags.socketEnabled = false;
            }
          });

          return socket;
        } catch (e) {
          console.error('[config.js] Failed to create socket connection:', e);
          return {
            on: () => {},
            emit: () => {},
            disconnect: () => {}
          }; // Return mock socket object
        }
      },
      
      isOffline: function() {
        return !navigator.onLine || this.featureFlags.offline;
      }
    };

    console.log('[config.js] Configuration loaded successfully');
    
    const configLoadedEvent = new CustomEvent('app-config-loaded', {
      detail: { config: window.APP_CONFIG }
    });
    document.dispatchEvent(configLoadedEvent);

  } catch (error) {
    console.error('[config.js] Error setting up configuration:', error);

    // Safer fallback configuration
    window.APP_CONFIG = {
      API_BASE_URL: 'https://iot-tracker-api.vercel.app',
      environment: 'production',
      version: '1.0.0',
      allowGuestMode: true,
      allowDemoMode: true,
      featureFlags: {
        socketEnabled: false,
        offline: false
      },
      isOffline: function() {
        return !navigator.onLine || this.featureFlags.offline;
      },
      createSocketConnection: function() {
        console.warn('[config.js] Using fallback mock socket connection');
        return {
          on: () => {},
          emit: () => {},
          disconnect: () => {}
        };
      }
    };

    const configErrorEvent = new CustomEvent('app-config-error', {
      detail: { error: error.message }
    });
    document.dispatchEvent(configErrorEvent);
  }
})();

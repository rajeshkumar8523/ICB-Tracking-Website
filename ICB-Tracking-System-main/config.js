// Configuration file for API endpoints and application settings
(function() {
  // Initialize APP_CONFIG immediately with fallback values
  window.APP_CONFIG = window.APP_CONFIG || {
    API_BASE_URL: 'https://icb-tracking-website.vercel.app', // Primary endpoint
    FALLBACK_API_URL: 'https://iot-tracker-api.vercel.app',  // Secondary endpoint
    featureFlags: { 
      socketEnabled: false,
      offline: false
    },
    createSocketConnection: function() {
      return {
        on: () => {},
        emit: () => {},
        disconnect: () => {},
        connected: false
      };
    }
  };

  try {
    // Detect environment
    const hostname = window.location.hostname;
    let API_BASE_URL = 'https://icb-tracking-website.vercel.app'; // Primary production URL
    let FALLBACK_API_URL = 'https://iot-tracker-api.vercel.app';  // Fallback URL
    let environment = 'production';

    // Local development configuration
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      API_BASE_URL = 'http://localhost:3000';
      FALLBACK_API_URL = 'http://localhost:3001'; // Different port for fallback
      environment = 'development';
    }

    // Enhanced Socket.io configuration
    const socketConfig = {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,              // Increased from 3
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,          // Added max delay
      randomizationFactor: 0.5,             // Added for better backoff
      timeout: 15000,                       // Increased from 10000
      forceNew: false,                      // Changed to false for better connection reuse
      autoConnect: true,
      withCredentials: false,
      query: {
        "client": "web",
        "version": "1.0.0",
        "busTracking": "true"               // Added custom parameter
      }
    };

    // Update APP_CONFIG with all settings
    Object.assign(window.APP_CONFIG, {
      API_BASE_URL,
      FALLBACK_API_URL,
      environment,
      version: '1.1.0',                     // Updated version
      allowGuestMode: true,
      allowDemoMode: true,
      socketConfig,
      featureFlags: { 
        socketEnabled: true, 
        offline: false,
        realtimeUpdates: true               // Added new feature flag
      },
      
      // Enhanced socket connection creator
      createSocketConnection: function() {
        // Check if Socket.io is loaded
        if (typeof io === 'undefined') {
          console.error('Socket.io library not loaded');
          this.featureFlags.socketEnabled = false;
          return this.createMockSocket();
        }

        try {
          // Create socket with enhanced configuration
          const socket = io(this.API_BASE_URL, this.socketConfig);

          // Enhanced error handling
          socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            this.featureFlags.socketEnabled = false;
            
            // Attempt fallback connection if primary fails
            if (err.message.includes('failed') || err.message.includes('refused')) {
              console.warn('Attempting fallback socket connection...');
              return io(this.FALLBACK_API_URL, this.socketConfig);
            }
          });

          socket.on('reconnect_attempt', (attempt) => {
            console.log(`Reconnection attempt ${attempt}`);
          });

          socket.on('reconnect_failed', () => {
            console.error('Reconnection failed');
            this.featureFlags.socketEnabled = false;
          });

          return socket;
        } catch (e) {
          console.error('Failed to create socket:', e);
          return this.createMockSocket();
        }
      },
      
      // Helper method for mock sockets
      createMockSocket: function() {
        console.warn('Using mock socket connection');
        return {
          on: () => {},
          emit: () => {},
          disconnect: () => {},
          connected: false
        };
      },
      
      // Enhanced offline detection
      isOffline: function() {
        const isOffline = !navigator.onLine || this.featureFlags.offline;
        if (isOffline) {
          console.warn('Application is in offline mode');
        }
        return isOffline;
      },
      
      // New method for API endpoint selection
      getActiveApiUrl: function() {
        return this.featureFlags.socketEnabled ? this.API_BASE_URL : this.FALLBACK_API_URL;
      }
    });

    // Dispatch loaded event with full configuration
    const configLoadedEvent = new CustomEvent('app-config-loaded', {
      detail: { 
        config: window.APP_CONFIG,
        timestamp: new Date().toISOString()
      }
    });
    document.dispatchEvent(configLoadedEvent);

    console.log('Application configuration loaded successfully');

  } catch (error) {
    console.error('Error in config initialization:', error);
    
    // Enhanced error event with more details
    const configErrorEvent = new CustomEvent('app-config-error', {
      detail: { 
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
    document.dispatchEvent(configErrorEvent);
    
    // Ensure we always have a valid config even after errors
    window.APP_CONFIG = window.APP_CONFIG || {
      API_BASE_URL: 'https://icb-tracking-website.vercel.app',
      FALLBACK_API_URL: 'https://iot-tracker-api.vercel.app',
      featureFlags: {
        socketEnabled: false,
        offline: false
      },
      createSocketConnection: function() {
        return {
          on: () => {},
          emit: () => {},
          disconnect: () => {},
          connected: false
        };
      }
    };
  }
})();

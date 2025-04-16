(function() {
  try {
    // Detect environment 
    const hostname = window.location.hostname;

    // Default to production (Vercel deployment)
    let API_BASE_URL = 'https://icb-tracking-website.vercel.app'; // Replace with your backend URL
    let environment = 'production';

    // If running locally, use localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      API_BASE_URL = 'http://localhost:5000';
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
      }
    };

    // Add helper methods
    window.APP_CONFIG.isOffline = function() {
      return !navigator.onLine || this.featureFlags.offline;
    };

    window.APP_CONFIG.createSocketConnection = function() {
      if (!window.io) {
        console.error('[config.js] Socket.io library not loaded');
        return null;
      }

      try {
        const socket = io(this.API_BASE_URL, this.socketConfig);

        socket.on('connect_error', (err) => {
          console.error('[config.js] Socket connection error:', err);
          if (this.environment === 'production') {
            this.featureFlags.socketEnabled = false;
            socket.disconnect();
          }
        });

        return socket;
      } catch (e) {
        console.error('[config.js] Failed to create socket connection:', e);
        return null;
      }
    };

    console.log('[config.js] Configuration loaded successfully');

    const configLoadedEvent = new CustomEvent('app-config-loaded', { 
      detail: { config: window.APP_CONFIG } 
    });
    document.dispatchEvent(configLoadedEvent);

  } catch (error) {
    console.error('[config.js] Error setting up configuration:', error);

    window.APP_CONFIG = window.APP_CONFIG || {
      API_BASE_URL: 'https://icb-tracking-website.vercel.app',
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
      }
    };

    const configErrorEvent = new CustomEvent('app-config-error', { 
      detail: { error: error.message } 
    });
    document.dispatchEvent(configErrorEvent);
  }
})();

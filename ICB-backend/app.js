require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const socketio = require("socket.io");
const http = require("http");
const path = require("path");
const cors = require("cors");

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Configure CORS to allow all origins and ensure Vercel connections work
app.use(cors({
  origin: '*',  // Allow all origins to connect
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// Add CORS preflight for all routes
app.options('*', cors());

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../ICB-Tracking-System-main/public')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://rajesh:rajesh@cluster0.cqkgbx3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
let isDbConnected = false;

// Connect to MongoDB with improved error handling and retry logic
const connectWithRetry = () => {
  console.log('MongoDB connection with retry');
  mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 15000, // Increased timeout
    maxPoolSize: 10,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    retryWrites: true,
  })
  .then(() => {
    console.log("MongoDB Connected Successfully");
    isDbConnected = true;
  })
  .catch(err => {
    console.error('MongoDB connection unsuccessful, retry after 5 seconds:', err.message);
    isDbConnected = false;
    setTimeout(connectWithRetry, 5000);
  });
};

// Initial connection attempt
connectWithRetry();

// Set up MongoDB connection listeners
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
  isDbConnected = true;
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
  isDbConnected = false;
  // Attempt to reconnect
  setTimeout(connectWithRetry, 5000);
});

mongoose.connection.on('error', err => {
  console.log('MongoDB connection error:', err.message);
  isDbConnected = false;
});

// Configure Socket.IO with enhanced CORS settings for Vercel deployment
const io = socketio(server, {
  cors: {
    origin: '*',  // Allow all origins (critical for Vercel deployment)
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Accept", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 60000,
  cookie: false
});

// Add diagnostic event listeners to help debug socket issues
io.engine.on("connection_error", (err) => {
  console.log("Socket connection error:", err.req?.url, err.code, err.message, err.context);
});

// Middleware to log all socket events
io.use((socket, next) => {
  const address = socket.handshake.address;
  const transport = socket.conn.transport.name;
  console.log(`Socket connection attempt from ${address} using ${transport}`);
  next();
});

// Add special handler for location tracking
const locationUpdates = {
  lastUpdates: {},
  updateBusLocation: function(busNumber, data) {
    this.lastUpdates[busNumber] = {
      ...data,
      timestamp: new Date()
    };
  },
  getLastUpdate: function(busNumber) {
    return this.lastUpdates[busNumber] || null;
  },
  getAllUpdates: function() {
    return this.lastUpdates;
  }
};

// Database Schemas
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  contact: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  ipAddress: { type: String },
  lastLogin: { type: Date },
  role: { type: String, enum: ["user", "driver", "admin"], default: "user" },
  dob: { type: Date, required: true },
  gender: { type: String, required: true, enum: ["male", "female", "other"] },
  branch: { type: String, required: true },
  year: { type: Number, required: true, min: 1, max: 4 }
});

const busSchema = new mongoose.Schema({
  busNumber: { type: String, required: true, unique: true },
  driverId: { type: String, required: true },
  route: { type: String, required: true },
  currentStatus: { type: String, enum: ["active", "inactive", "maintenance"], default: "active" },
  capacity: { type: Number, default: 40 },
  contactNumber: { type: String },
  lastUpdated: { type: Date },
  latitude: { type: Number },
  longitude: { type: Number },
});

const trackerSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  busNumber: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speed: { type: Number },
  direction: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

// Models
const User = mongoose.model("User", userSchema);
const Bus = mongoose.model("Bus", busSchema);
const Tracker = mongoose.model("Tracker", trackerSchema);

// Utility function
const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Socket.IO Connection Handling
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on("joinBus", (busNumber) => {
    socket.join(busNumber);
    console.log(`Client ${socket.id} joined bus ${busNumber}`);
    
    // Send last known location if available
    const lastUpdate = locationUpdates.getLastUpdate(busNumber);
    if (lastUpdate) {
      socket.emit("busLocation", lastUpdate);
    }
  });
  
  socket.on("locationUpdate", async (data) => {
    try {
      const { busNumber, latitude, longitude, speed, direction } = data;
      
      // Store latest update in memory for quick access
      locationUpdates.updateBusLocation(busNumber, data);
      
      // Check if in guest mode
      const isGuestMode = data.guestMode === true;
      
      if (!isDbConnected && !isGuestMode) {
        socket.emit("error", { message: "Database not connected, location update not saved" });
        return;
      }
      
      // Skip database storage for guest mode
      if (isGuestMode) {
        // Just broadcast the update without saving
        io.to(busNumber).emit("busLocation", {
          busNumber,
          latitude,
          longitude,
          speed,
          direction,
          timestamp: new Date(),
          guestMode: true
        });
        return;
      }
      
      // Save to database (only for authenticated updates)
      const tracker = new Tracker({
        deviceId: socket.id,
        busNumber,
        latitude,
        longitude,
        speed,
        direction,
      });
      await tracker.save();
      await Bus.findOneAndUpdate(
        { busNumber },
        { lastUpdated: new Date(), latitude, longitude },
        { upsert: true }
      );
      
      // Emit to all clients in the bus room
      io.to(busNumber).emit("busLocation", {
        busNumber,
        latitude,
        longitude,
        speed,
        direction,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error handling location update:", error);
      socket.emit("error", { message: "Failed to update location" });
    }
  });
  
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// API Routes
app.post("/api/register", async (req, res, next) => {
  try {
    const { userId, name, contact, email, password, role, dob, gender, branch, year } = req.body;
    
    // Validate input with better error handling
    if (!userId || !name || !contact || !email || !password || !dob || !gender || !branch || !year) {
      console.log("Registration failed - missing fields:", { 
        userId: !!userId, 
        name: !!name, 
        contact: !!contact, 
        email: !!email, 
        password: !!password,
        dob: !!dob,
        gender: !!gender,
        branch: !!branch,
        year: !!year
      });
      
      return res.status(400).json({
        status: "fail",
        message: "Please provide all required fields: userId, name, contact, email, password, dob, gender, branch, year",
        receivedFields: Object.keys(req.body)
      });
    }
    
    // Log registration attempt for debugging
    console.log(`Registration attempt for user: ${userId}, email: ${email}`);
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Store in database
    const existingUser = await User.findOne({ $or: [{ userId }, { email }] });
    if (existingUser) {
      console.log(`User already exists in database: ${userId}`);
      return res.status(400).json({
        status: "fail",
        message: "User ID or Email already exists",
      });
    }
    
    try {
      const newUser = await User.create({
        userId,
        name,
        contact,
        email,
        password,
        ipAddress: getClientIp(req),
        lastLogin: new Date(),
        role: role || "user",
        dob: new Date(dob),
        gender,
        branch,
        year: parseInt(year)
      });
      
      console.log(`Successfully created user in database: ${userId}, role: ${newUser.role}`);
      
      res.status(201).json({
        status: "success",
        data: {
          user: {
            userId: newUser.userId,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
          },
        },
      });
    } catch (dbError) {
      console.error(`Database error during user creation: ${dbError.message}`);
      return res.status(500).json({
        status: "error",
        message: "Failed to create user in database",
      });
    }
  } catch (err) {
    console.error(`Unexpected error in registration: ${err.message}`);
    next(err);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    
    // Log login attempt for debugging
    console.log(`Login attempt for user: ${userId}`);
    
    if (!userId || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide user ID and password!",
      });
    }
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Check database
    const user = await User.findOne({ userId });
    
    if (!user) {
      console.log(`User not found in database: ${userId}`);
      return res.status(401).json({
        status: "fail",
        message: "Incorrect user ID or password",
      });
    }
    
    if (password !== user.password) {
      console.log(`Invalid password for user: ${userId}`);
      return res.status(401).json({
        status: "fail",
        message: "Incorrect user ID or password",
      });
    }
    
    user.ipAddress = getClientIp(req);
    user.lastLogin = new Date();
    await user.save();
    
    console.log(`User authenticated successfully: ${userId}, role: ${user.role}`);
    
    res.status(200).json({
      status: "success",
      data: {
        user: {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          ipAddress: user.ipAddress,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (err) {
    console.error(`Error in login: ${err.message}`);
    next(err);
  }
});

app.post("/api/reset-password", async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide user ID and new password",
      });
    }
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Update in database
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/me/:userId", async (req, res, next) => {
  try {
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Get from database
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }
    
    res.status(200).json({
      status: "success",
      data: {
        user: {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/buses", async (req, res, next) => {
  try {
    const { busNumber, route, driverId, capacity, contactNumber } = req.body;
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Add to database
    const bus = await Bus.create({
      busNumber,
      route,
      driverId,
      capacity,
      contactNumber,
    });
    
    res.status(201).json({
      status: "success",
      data: { bus },
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/buses", async (req, res) => {
  try {
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    const buses = await Bus.find();
    
    res.status(200).json({
      status: "success",
      results: buses.length,
      data: { buses },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch buses",
    });
  }
});

app.get("/api/buses/:busNumber", async (req, res) => {
  try {
    const { busNumber } = req.params;
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Check database
    const bus = await Bus.findOne({ busNumber });
    if (!bus) {
      return res.status(404).json({
        status: "fail",
        message: "Bus not found",
      });
    }
    
    res.status(200).json({
      status: "success",
      data: { bus },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch bus data",
    });
  }
});

app.post("/api/trackers", async (req, res, next) => {
  try {
    const { busNumber, latitude, longitude, speed, direction } = req.body;
    
    if (!busNumber || !latitude || !longitude) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide busNumber, latitude, and longitude",
      });
    }
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        status: "fail",
        message: "Latitude and longitude must be valid numbers",
      });
    }
    
    const latVal = parseFloat(latitude);
    const longVal = parseFloat(longitude);
    const speedVal = speed ? parseFloat(speed) : null;
    const directionVal = direction ? parseFloat(direction) : null;
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Add to database
    const tracker = await Tracker.create({
      deviceId: req.headers["device-id"] || "web",
      busNumber,
      latitude: latVal,
      longitude: longVal,
      speed: speedVal,
      direction: directionVal,
    });
    
    await Bus.findOneAndUpdate(
      { busNumber },
      { 
        lastUpdated: new Date(),
        latitude: latVal,
        longitude: longVal
      },
      { upsert: true, new: true }
    );
    
    io.to(busNumber).emit("busLocation", {
      busNumber,
      latitude: tracker.latitude,
      longitude: tracker.longitude,
      speed: tracker.speed,
      direction: tracker.direction,
      timestamp: tracker.timestamp,
    });
    
    res.status(201).json({
      status: "success",
      data: {
        tracker: {
          busNumber: tracker.busNumber,
          latitude: tracker.latitude,
          longitude: tracker.longitude,
          speed: tracker.speed,
          direction: tracker.direction,
          timestamp: tracker.timestamp,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/trackers/:busNumber", async (req, res) => {
  try {
    const { busNumber } = req.params;
    const { limit = 1 } = req.query;
    const limitNum = parseInt(limit);
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    const trackers = await Tracker.find({ busNumber })
      .sort({ timestamp: -1 })
      .limit(limitNum);
    
    res.status(200).json({
      status: "success",
      results: trackers.length,
      data: { trackers },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch trackers",
    });
  }
});

app.get("/api/trackers/history/:busNumber", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Query database
    const query = { busNumber: req.params.busNumber };
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    const trackers = await Tracker.find(query).sort({ timestamp: 1 });
    res.status(200).json({
      status: "success",
      results: trackers.length,
      data: { trackers },
    });
  } catch (err) {
    next(err);
  }
});

// Add improved trackers endpoints for location tracking
app.get("/api/trackers/recent/:busNumber", async (req, res) => {
  try {
    const { busNumber } = req.params;
    const { since } = req.query;
    let sinceDate = since ? new Date(since) : new Date(Date.now() - 3600000); // Default to last hour
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Check memory cache first for latest update
    const lastMemoryUpdate = locationUpdates.getLastUpdate(busNumber);
    
    const query = { 
      busNumber,
      timestamp: { $gte: sinceDate }
    };
    
    const trackers = await Tracker.find(query)
      .sort({ timestamp: -1 })
      .limit(10);
    
    // Merge with memory cache if more recent
    if (lastMemoryUpdate && (!trackers.length || 
        new Date(lastMemoryUpdate.timestamp) > new Date(trackers[0].timestamp))) {
      res.status(200).json({
        status: "success",
        results: trackers.length + 1,
        source: "hybrid",
        data: { 
          trackers: [lastMemoryUpdate, ...trackers].slice(0, 10)
        },
      });
    } else {
      res.status(200).json({
        status: "success",
        results: trackers.length,
        source: "database",
        data: { trackers },
      });
    }
  } catch (err) {
    console.error("Error fetching recent trackers:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch recent tracking data",
    });
  }
});

// Add Socket.io server status API endpoint
app.get("/api/socket-status", (req, res) => {
  const connections = io.sockets.sockets ? Object.keys(io.sockets.sockets).length : 0;
  
  res.status(200).json({
    status: "success",
    socketActive: true,
    connections: connections,
    serverTime: new Date().toISOString(),
    serverUrl: req.protocol + '://' + req.get('host'),
    corsSettings: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    }
  });
});

// Add a fallback API endpoint for bus updates when socket doesn't work
app.get("/api/bus-updates", async (req, res) => {
  try {
    const { since } = req.query;
    let sinceDate = since ? new Date(since) : new Date(Date.now() - 3600000); // Default to last hour
    
    if (!isDbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database connection unavailable. Please try again later."
      });
    }
    
    // Get recent bus updates from database
    const recentUpdates = await Tracker.find({
      timestamp: { $gte: sinceDate }
    })
    .sort({ timestamp: -1 })
    .limit(50);
    
    // Get current bus data
    const buses = await Bus.find();
    
    // Prepare response
    res.status(200).json({
      status: "success",
      source: "database",
      serverTime: new Date().toISOString(),
      data: {
        updates: recentUpdates,
        buses: buses
      }
    });
  } catch (err) {
    console.error("Error fetching bus updates:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch bus updates",
    });
  }
});

// Enhanced status endpoint with more details
app.get("/api/status", (req, res) => {
  if (!isDbConnected) {
    return res.status(200).json({
      status: "partial",
      message: "API is operational but database is disconnected",
      dbConnected: false,
      mongoUri: MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Hide credentials
      serverTime: new Date().toISOString(),
      uptime: process.uptime()
    });
  }
  
  res.status(200).json({
    status: "success",
    message: "API is fully operational",
    dbConnected: true,
    mongoUri: MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Hide credentials
    serverTime: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Redirect for compatibility with older versions
app.get("/api/bus-location/:busNumber", (req, res) => {
  res.redirect(`/api/trackers/${req.params.busNumber}`);
});

// Route for serving index HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../ICB-Tracking-System-main/public/INDEX/index.html'));
});

// Catch-all route
app.get("*", (req, res) => {
  const urlPath = req.path.substring(1);
  const firstSegment = urlPath.split('/')[0].toUpperCase();
  
  if (firstSegment && firstSegment !== 'API') {
    const htmlFile = path.join(__dirname, `../ICB-Tracking-System-main/public/${firstSegment}/${firstSegment.toLowerCase()}.html`);
    res.sendFile(htmlFile, (err) => {
      if (err) {
        res.sendFile(path.join(__dirname, '../ICB-Tracking-System-main/public/INDEX/index.html'));
      }
    });
  } else {
    res.sendFile(path.join(__dirname, '../ICB-Tracking-System-main/public/INDEX/index.html'));
  }
});

// Global error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Add public routes for guest mode access
app.get("/api/public/buses", async (req, res) => {
  try {
    // This endpoint is always accessible, even in guest mode
    if (!isDbConnected) {
      // Return sample data for guest mode
      return res.status(200).json({
        status: "success",
        results: 3,
        data: { 
          buses: [
            { busNumber: "01", route: "COLLEGE TO JADCHERLA", currentStatus: "active", contactNumber: "+917981321536" },
            { busNumber: "02", route: "COLLEGE TO KOTHAKOTA", currentStatus: "active", contactNumber: "+917981321537" },
            { busNumber: "03", route: "COLLEGE TO METTUGADA", currentStatus: "inactive", contactNumber: "+917981321538" }
          ]
        }
      });
    }
    
    // Get data from database
    const buses = await Bus.find();
    
    res.status(200).json({
      status: "success",
      results: buses.length,
      data: { buses }
    });
  } catch (err) {
    console.error("Error fetching public buses:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch buses"
    });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


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

// Configure CORS
app.use(cors({
  origin: ['https://icb-tracking-website.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// Add CORS preflight for all routes
app.options('*', cors());

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://icb-tracking-website.vercel.app');
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

// Mock data (used only if DB connection fails)
let mockBuses = [
  { busNumber: "01", route: "COLLEGE TO JADCHERLA", driverId: "D1001", currentStatus: "active", capacity: 40, contactNumber: "+917981321536", lastUpdated: new Date() },
  { busNumber: "02", route: "COLLEGE TO KOTHAKOTA", driverId: "D1002", currentStatus: "active", capacity: 35, contactNumber: "+917981321537", lastUpdated: new Date() },
  { busNumber: "03", route: "COLLEGE TO METTUGADA", driverId: "D1003", currentStatus: "active", capacity: 38, contactNumber: "+917981321538", lastUpdated: new Date() },
  { busNumber: "04", route: "COLLEGE TO PADMAVATHI-COLLONY", driverId: "D1004", currentStatus: "active", capacity: 42, contactNumber: "+917981321539", lastUpdated: new Date() },
  { busNumber: "05", route: "COLLEGE TO HOUSING-BOARD", driverId: "D1005", currentStatus: "active", capacity: 40, contactNumber: "+917981321540", lastUpdated: new Date() },
  { busNumber: "06", route: "COLLEGE TO KOTHAKOTA", driverId: "D1006", currentStatus: "active", capacity: 35, contactNumber: "+917981321541", lastUpdated: new Date() },
  { busNumber: "07", route: "COLLEGE TO HOUSING-BOARD", driverId: "D1007", currentStatus: "inactive", capacity: 40, contactNumber: "+917981321542", lastUpdated: new Date() }
];
let mockTrackers = [];
let mockUsers = [];

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

// Configure Socket.IO with enhanced CORS settings
const io = socketio(server, {
  cors: {
    origin: "*",  // Allow connections from all origins
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Accept", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 30000,
  pingInterval: 25000,
  connectTimeout: 30000
});

// Add diagnostic event listeners to help debug socket issues
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err.req, err.code, err.message, err.context);
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
      
      if (isDbConnected) {
        // Save to database
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
      } else {
        // Update mock data
        const trackerData = {
          deviceId: socket.id,
          busNumber,
          latitude,
          longitude,
          speed,
          direction,
          timestamp: new Date()
        };
        
        mockTrackers.push(trackerData);
        
        const busIndex = mockBuses.findIndex(b => b.busNumber === busNumber);
        if (busIndex !== -1) {
          mockBuses[busIndex].lastUpdated = new Date();
          mockBuses[busIndex].latitude = latitude;
          mockBuses[busIndex].longitude = longitude;
        }
      }
      
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
    const { userId, name, contact, email, password, role } = req.body;
    
    // Validate input with better error handling
    if (!userId || !name || !contact || !email || !password) {
      console.log("Registration failed - missing fields:", { 
        userId: !!userId, 
        name: !!name, 
        contact: !!contact, 
        email: !!email, 
        password: !!password 
      });
      
      return res.status(400).json({
        status: "fail",
        message: "Please provide all required fields: userId, name, contact, email, password",
        receivedFields: Object.keys(req.body)
      });
    }
    
    // Log registration attempt for debugging
    console.log(`Registration attempt for user: ${userId}, email: ${email}`);
    
    if (!isDbConnected) {
      // Store in mock data
      const existingUser = mockUsers.find(u => u.userId === userId || u.email === email);
      if (existingUser) {
        console.log(`User already exists in mock data: ${userId}`);
        return res.status(400).json({
          status: "fail",
          message: "User ID or Email already exists",
        });
      }
      
      const newUser = {
        userId, 
        name, 
        contact, 
        email, 
        password,
        ipAddress: getClientIp(req),
        lastLogin: new Date(),
        role: role || "user"
      };
      
      mockUsers.push(newUser);
      
      console.log(`Successfully created mock user: ${userId}, role: ${newUser.role}`);
      
      return res.status(201).json({
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
      // Check mock data - improved user search
      const user = mockUsers.find(u => u.userId === userId);
      
      if (!user) {
        console.log(`User not found in mock data: ${userId}`);
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
      
      console.log(`Mock user authenticated successfully: ${userId}, role: ${user.role}`);
      
      return res.status(200).json({
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
      // Update mock data
      const userIndex = mockUsers.findIndex(u => u.userId === userId);
      if (userIndex === -1) {
        return res.status(404).json({
          status: "fail",
          message: "User not found",
        });
      }
      
      mockUsers[userIndex].password = newPassword;
      
      return res.status(200).json({
        status: "success",
        message: "Password updated successfully",
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
      // Get from mock data
      const user = mockUsers.find(u => u.userId === req.params.userId);
      if (!user) {
        return res.status(404).json({
          status: "fail",
          message: "User not found",
        });
      }
      
      return res.status(200).json({
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
      // Add to mock data
      const newBus = {
        busNumber,
        route,
        driverId,
        capacity,
        contactNumber,
        currentStatus: "active",
        lastUpdated: new Date()
      };
      
      mockBuses.push(newBus);
      
      return res.status(201).json({
        status: "success",
        data: { bus: newBus },
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
    const buses = isDbConnected ? await Bus.find() : mockBuses;
    
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
      // Check mock data
      const bus = mockBuses.find(b => b.busNumber === busNumber);
      if (!bus) {
        return res.status(404).json({
          status: "fail",
          message: "Bus not found",
        });
      }
      
      return res.status(200).json({
        status: "success",
        data: { bus },
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
      // Add to mock data
      const tracker = {
        deviceId: req.headers["device-id"] || "web",
        busNumber,
        latitude: latVal,
        longitude: longVal,
        speed: speedVal,
        direction: directionVal,
        timestamp: new Date()
      };
      
      mockTrackers.push(tracker);
      
      // Update mock bus data
      const busIndex = mockBuses.findIndex(b => b.busNumber === busNumber);
      if (busIndex !== -1) {
        mockBuses[busIndex].lastUpdated = new Date();
        mockBuses[busIndex].latitude = latVal;
        mockBuses[busIndex].longitude = longVal;
      }
      
      // Emit socket event
      io.to(busNumber).emit("busLocation", {
        busNumber,
        latitude: latVal,
        longitude: longVal,
        speed: speedVal,
        direction: directionVal,
        timestamp: new Date(),
      });
      
      return res.status(201).json({
        status: "success",
        data: {
          tracker: {
            busNumber,
            latitude: latVal,
            longitude: longVal,
            speed: speedVal,
            direction: directionVal,
            timestamp: new Date(),
          },
        },
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
    
    let trackers;
    if (isDbConnected) {
      trackers = await Tracker.find({ busNumber })
        .sort({ timestamp: -1 })
        .limit(limitNum);
    } else {
      trackers = mockTrackers
        .filter(t => t.busNumber === busNumber)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limitNum);
    }
    
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
      // Filter mock data
      let filteredTrackers = mockTrackers.filter(t => t.busNumber === req.params.busNumber);
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        filteredTrackers = filteredTrackers.filter(t => {
          const timestamp = new Date(t.timestamp);
          return timestamp >= start && timestamp <= end;
        });
      }
      
      filteredTrackers.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      return res.status(200).json({
        status: "success",
        results: filteredTrackers.length,
        data: { trackers: filteredTrackers },
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
    
    // Check memory cache first for latest update
    const lastMemoryUpdate = locationUpdates.getLastUpdate(busNumber);
    
    if (isDbConnected) {
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
    } else {
      // Use mock data
      let filteredTrackers = mockTrackers
        .filter(t => t.busNumber === busNumber && new Date(t.timestamp) >= sinceDate)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);
      
      // Merge with memory cache if more recent
      if (lastMemoryUpdate) {
        if (!filteredTrackers.length || 
            new Date(lastMemoryUpdate.timestamp) > new Date(filteredTrackers[0].timestamp)) {
          filteredTrackers = [lastMemoryUpdate, ...filteredTrackers].slice(0, 10);
        }
      }
      
      res.status(200).json({
        status: "success",
        results: filteredTrackers.length,
        source: "cache",
        data: { trackers: filteredTrackers },
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

// Enhanced status endpoint with more details
app.get("/api/status", (req, res) => {
  // Count buses with recent locations (updated in the last hour)
  const oneHourAgo = new Date(Date.now() - 3600000);
  const activeBuses = mockBuses.filter(b => 
    b.lastUpdated && new Date(b.lastUpdated) > oneHourAgo
  ).length;
  
  const memoryUpdates = Object.keys(locationUpdates.getAllUpdates()).length;
  
  res.status(200).json({
    status: "success",
    message: "API is operational",
    dbConnected: isDbConnected,
    mongoUri: MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Hide credentials
    activeBuses: activeBuses,
    recentUpdates: memoryUpdates,
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

// API Routes for Socket.io health check
app.get("/api/socket-status", (req, res) => {
  res.status(200).json({
    status: "success",
    socketActive: true,
    connections: Object.keys(io.sockets.sockets).length,
    serverTime: new Date().toISOString()
  });
});

// Add a fallback API endpoint for bus updates when socket doesn't work
app.get("/api/bus-updates", async (req, res) => {
  try {
    const { since } = req.query;
    let sinceDate = since ? new Date(since) : new Date(Date.now() - 3600000); // Default to last hour
    
    if (isDbConnected) {
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
    } else {
      // Use mock data
      const recentUpdates = mockTrackers
        .filter(t => new Date(t.timestamp) >= sinceDate)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);
      
      res.status(200).json({
        status: "success",
        source: "mock",
        serverTime: new Date().toISOString(),
        data: {
          updates: recentUpdates,
          buses: mockBuses
        }
      });
    }
  } catch (err) {
    console.error("Error fetching bus updates:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch bus updates",
    });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


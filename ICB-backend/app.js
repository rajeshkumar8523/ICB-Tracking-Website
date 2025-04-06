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

// Configure CORS with more specific options for Vercel deployment
app.use(cors({
  origin: ['https://icb-tracking-website.vercel.app', 'http://localhost:3000', 'http://localhost:5000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend
app.use(express.static(path.join(__dirname, '../ICB-Tracking-System-main/public')));

// MongoDB Connection
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://rajesh:rajesh@cluster0.cqkgbx3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create mock data for demo purposes (in case DB connection fails)
let mockBuses = [
  {
    busNumber: "01",
    route: "COLLEGE TO JADCHERLA",
    driverId: "D1001",
    currentStatus: "active",
    capacity: 40,
    contactNumber: "+917981321536",
    lastUpdated: new Date()
  },
  {
    busNumber: "02",
    route: "COLLEGE TO KOTHAKOTA",
    driverId: "D1002",
    currentStatus: "active",
    capacity: 35,
    contactNumber: "+917981321537",
    lastUpdated: new Date()
  },
  {
    busNumber: "03",
    route: "COLLEGE TO METTUGADA",
    driverId: "D1003",
    currentStatus: "active",
    capacity: 38,
    contactNumber: "+917981321538",
    lastUpdated: new Date()
  },
  {
    busNumber: "04",
    route: "COLLEGE TO PADMAVATHI-COLLONY",
    driverId: "D1004",
    currentStatus: "active",
    capacity: 42,
    contactNumber: "+917981321539",
    lastUpdated: new Date()
  },
  {
    busNumber: "05",
    route: "COLLEGE TO HOUSING-BOARD",
    driverId: "D1005",
    currentStatus: "active",
    capacity: 40,
    contactNumber: "+917981321540",
    lastUpdated: new Date()
  },
  {
    busNumber: "06",
    route: "COLLEGE TO KOTHAKOTA",
    driverId: "D1006",
    currentStatus: "active",
    capacity: 35,
    contactNumber: "+917981321541",
    lastUpdated: new Date()
  },
  {
    busNumber: "07",
    route: "COLLEGE TO HOUSING-BOARD",
    driverId: "D1007",
    currentStatus: "inactive",
    capacity: 40,
    contactNumber: "+917981321542",
    lastUpdated: new Date()
  }
];

let mockTrackers = [
  {
    deviceId: "tracker-01",
    busNumber: "01",
    latitude: 16.6989,
    longitude: 77.9405,
    speed: 35,
    direction: 90,
    timestamp: new Date()
  },
  {
    deviceId: "tracker-02",
    busNumber: "02",
    latitude: 16.7089,
    longitude: 77.9505,
    speed: 40,
    direction: 180,
    timestamp: new Date()
  },
  {
    deviceId: "tracker-03",
    busNumber: "03",
    latitude: 16.6889,
    longitude: 77.9305,
    speed: 25,
    direction: 270,
    timestamp: new Date()
  },
  {
    deviceId: "tracker-04",
    busNumber: "04",
    latitude: 16.7189,
    longitude: 77.9605,
    speed: 30,
    direction: 0,
    timestamp: new Date()
  },
  {
    deviceId: "tracker-05",
    busNumber: "05",
    latitude: 16.6789,
    longitude: 77.9205,
    speed: 20,
    direction: 45,
    timestamp: new Date()
  },
  {
    deviceId: "tracker-06",
    busNumber: "06",
    latitude: 16.7289,
    longitude: 77.9705,
    speed: 38,
    direction: 135,
    timestamp: new Date()
  },
  {
    deviceId: "tracker-07",
    busNumber: "07",
    latitude: 16.6689,
    longitude: 77.9105,
    speed: 0,
    direction: 225,
    timestamp: new Date()
  }
];

// Add initial mock users for testing - will be populated if DB connection fails
let mockUsers = [];

let isDbConnected = false;

// Improve MongoDB connection with retry logic and better error handling
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds
    maxPoolSize: 10, // Maintain up to 10 socket connections
  })
  .then(() => {
    console.log("MongoDB Connected Successfully");
    isDbConnected = true;
  })
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    console.log("Running with mock data instead of database");
    
    // Add a default user to mock data for testing when DB is down
    mockUsers.push({
      userId: "test",
      name: "Test User",
      contact: "1234567890",
      email: "test@example.com",
      password: "test",
      role: "user",
      lastLogin: new Date()
    });
  });

// Configure Socket.IO with appropriate CORS settings
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
});

// Schemas and Models
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
  currentStatus: {
    type: String,
    enum: ["active", "inactive", "maintenance"],
    default: "active",
  },
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
const User = mongoose.model("User", userSchema);
const Bus = mongoose.model("Bus", busSchema);
const Tracker = mongoose.model("Tracker", trackerSchema);

// Utility functions
const getClientIp = (req) => {
  return (
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null)
  );
};

// Socket.IO Connection Handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  
  socket.on("joinBus", (busNumber) => {
    socket.join(busNumber);
    console.log(`Socket ${socket.id} joined bus ${busNumber}`);
  });
  
  socket.on("locationUpdate", async (data) => {
    try {
      const { busNumber, latitude, longitude, speed, direction } = data;
      
      if (isDbConnected) {
        // Save to database if connected
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
          { 
            lastUpdated: new Date(),
            latitude: latitude,
            longitude: longitude 
          },
          { upsert: true }
        );
      } else {
        // Update mock data if database not connected
        const existingTrackerIndex = mockTrackers.findIndex(t => t.busNumber === busNumber);
        if (existingTrackerIndex !== -1) {
          mockTrackers[existingTrackerIndex] = {
            deviceId: socket.id,
            busNumber,
            latitude,
            longitude,
            speed,
            direction,
            timestamp: new Date()
          };
        } else {
          mockTrackers.push({
            deviceId: socket.id,
            busNumber,
            latitude,
            longitude,
            speed,
            direction,
            timestamp: new Date()
          });
        }
        
        // Update mock bus data with location
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
    console.log("Client disconnected:", socket.id);
  });
});

// API Routes - ensure they return appropriate status codes and clear messages
app.post("/api/register", async (req, res, next) => {
  try {
    console.log("Register request received:", req.body);
    const { userId, name, contact, email, password, role } = req.body;
    
    // Validate input
    if (!userId || !name || !contact || !email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide all required fields: userId, name, contact, email, password",
      });
    }
    
    if (!isDbConnected) {
      // Store in mock data if DB is not connected
      const existingUser = mockUsers.find(u => u.userId === userId || u.email === email);
      if (existingUser) {
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
      console.log("New user created in mock data:", newUser.userId);
      
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
    
    const existingUser = await User.findOne({ $or: [{ userId }, { email }] });
    if (existingUser) {
      return res.status(400).json({
        status: "fail",
        message: "User ID or Email already exists",
      });
    }
    const ipAddress = getClientIp(req);
    const newUser = await User.create({
      userId,
      name,
      contact,
      email,
      password,
      ipAddress,
      lastLogin: new Date(),
      role: role || "user",
    });
    console.log("New user created in database:", newUser.userId);
    
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
  } catch (err) {
    console.error("Register error:", err);
    next(err);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    console.log("Login request received:", req.body);
    const { userId, password } = req.body;
    
    if (!userId || !password) {
      console.log("Missing credentials - userId or password not provided");
      return res.status(400).json({
        status: "fail",
        message: "Please provide user ID and password!",
      });
    }
    
    if (!isDbConnected) {
      // Check mock data if DB is not connected
      console.log("Database not connected, checking mock users for:", userId);
      console.log("Available mock users:", mockUsers.map(u => u.userId).join(", "));
      
      const user = mockUsers.find(u => u.userId === userId);
      console.log("Found user in mock data:", user ? user.userId : "none");
      
      if (!user) {
        console.log(`User not found: ${userId}`);
        return res.status(401).json({
          status: "fail",
          message: "Incorrect user ID or password",
        });
      }
      
      console.log(`Comparing passwords for ${userId}: provided=${password}, stored=${user.password}`);
      if (password !== user.password) {
        console.log(`Password mismatch for user: ${userId}`);
        return res.status(401).json({
          status: "fail",
          message: "Incorrect user ID or password",
        });
      }
      
      user.ipAddress = getClientIp(req);
      user.lastLogin = new Date();
      
      console.log(`Login successful for user: ${userId} (mock data)`);
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
    
    console.log("Database connected, checking DB for user:", userId);
    const user = await User.findOne({ userId });
    console.log("Found user in database:", user ? user.userId : "none");
    
    if (!user) {
      console.log(`User not found in database: ${userId}`);
      return res.status(401).json({
        status: "fail",
        message: "Incorrect user ID or password",
      });
    }
    
    console.log(`Comparing passwords for ${userId}: provided=${password}, stored=${user.password}`);
    if (password !== user.password) {
      console.log(`Password mismatch for user: ${userId}`);
      return res.status(401).json({
        status: "fail",
        message: "Incorrect user ID or password",
      });
    }
    
    const ipAddress = getClientIp(req);
    user.ipAddress = ipAddress;
    user.lastLogin = new Date();
    await user.save();
    
    console.log(`Login successful for user: ${userId} (database)`);
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
    console.error("Login error:", err);
    next(err);
  }
});

// Add reset password endpoint
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
      // Update mock data if DB is not connected
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

// User profile route (no JWT required)
app.get("/api/me/:userId", async (req, res, next) => {
  try {
    if (!isDbConnected) {
      // Get from mock data if DB is not connected
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

// Bus Management Endpoints (without JWT protection)
app.post("/api/buses", async (req, res, next) => {
  try {
    const { busNumber, route, driverId, capacity, contactNumber } = req.body;
    
    if (!isDbConnected) {
      // Add to mock data if DB is not connected
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
        data: {
          bus: newBus,
        },
      });
    }
    
    const bus = await Bus.create({
      busNumber,
      route,
      driverId,
      capacity,
      contactNumber,
    });
    res.status(201).json({
      status: "success",
      data: {
        bus,
      },
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/buses", async (req, res) => {
  try {
    let buses;
    if (isDbConnected) {
      buses = await Bus.find();
    } else {
      buses = mockBuses;
    }
    
    res.status(200).json({
      status: "success",
      results: buses.length,
      data: {
        buses,
      },
    });
  } catch (err) {
    console.error("Error fetching buses:", err);
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
      // Check mock data if DB is not connected
      const bus = mockBuses.find(b => b.busNumber === busNumber);
      if (!bus) {
        return res.status(404).json({
          status: "fail",
          message: "Bus not found",
        });
      }
      
      return res.status(200).json({
        status: "success",
        data: {
          bus,
        },
      });
    }
    
    const bus = await Bus.findOne({ busNumber });
    if (!bus) {
      return res.status(404).json({
        status: "fail",
        message: "Bus not found",
      });
    }
    
    res.status(200).json({
      status: "success",
      data: {
        bus,
      },
    });
  } catch (err) {
    console.error("Error fetching bus:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch bus data",
    });
  }
});

// Location Tracking Endpoints
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
    
    if (!isDbConnected) {
      // Add to mock data if DB is not connected
      const tracker = {
        deviceId: req.headers["device-id"] || "web",
        busNumber,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: speed ? parseFloat(speed) : null,
        direction: direction ? parseFloat(direction) : null,
        timestamp: new Date()
      };
      
      mockTrackers.push(tracker);
      
      // Update mock bus data
      const busIndex = mockBuses.findIndex(b => b.busNumber === busNumber);
      if (busIndex !== -1) {
        mockBuses[busIndex].lastUpdated = new Date();
        mockBuses[busIndex].latitude = parseFloat(latitude);
        mockBuses[busIndex].longitude = parseFloat(longitude);
      }
      
      // Emit socket event
      io.to(busNumber).emit("busLocation", {
        busNumber,
        latitude: tracker.latitude,
        longitude: tracker.longitude,
        speed: tracker.speed,
        direction: tracker.direction,
        timestamp: tracker.timestamp,
      });
      
      return res.status(201).json({
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
    }
    
    const tracker = await Tracker.create({
      deviceId: req.headers["device-id"] || "web",
      busNumber,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: speed ? parseFloat(speed) : null,
      direction: direction ? parseFloat(direction) : null,
    });
    await Bus.findOneAndUpdate(
      { busNumber },
      { 
        lastUpdated: new Date(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
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
    
    let trackers;
    if (isDbConnected) {
      trackers = await Tracker.find({ busNumber })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit));
    } else {
      trackers = mockTrackers
        .filter(t => t.busNumber === busNumber)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, parseInt(limit));
    }
    
    res.status(200).json({
      status: "success",
      results: trackers.length,
      data: {
        trackers,
      },
    });
  } catch (err) {
    console.error("Error fetching trackers:", err);
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
      // Filter mock data if DB is not connected
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
        data: {
          trackers: filteredTrackers,
        },
      });
    }
    
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
      data: {
        trackers,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Add a heartbeat endpoint to verify API is working
app.get("/api/status", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "API is operational",
    dbConnected: isDbConnected,
    serverTime: new Date().toISOString()
  });
});

// Route for serving index HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../ICB-Tracking-System-main/public/INDEX/index.html'));
});

// Catch-all route to serve frontend for any route not matching API routes
app.get("*", (req, res) => {
  // Check if the URL corresponds to a specific frontend folder
  const urlPath = req.path.substring(1); // Remove the leading slash
  const firstSegment = urlPath.split('/')[0].toUpperCase();
  
  if (firstSegment && firstSegment !== 'API') {
    // Try to serve the corresponding HTML file
    const htmlFile = path.join(__dirname, `../ICB-Tracking-System-main/public/${firstSegment}/${firstSegment.toLowerCase()}.html`);
    res.sendFile(htmlFile, (err) => {
      if (err) {
        // If the file doesn't exist, fall back to index
        res.sendFile(path.join(__dirname, '../ICB-Tracking-System-main/public/INDEX/index.html'));
      }
    });
  } else {
    // Default to index for any other routes
    res.sendFile(path.join(__dirname, '../ICB-Tracking-System-main/public/INDEX/index.html'));
  }
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/status`);
});

// Error handling
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 🚨 Shutting down...");
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 🚨 Shutting down...");
  console.error(err.name, err.message);
});


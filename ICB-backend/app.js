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

// Add CORS middleware
app.use(cors());

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend
app.use(express.static(path.join(__dirname, '../ICB-Tracking-System-main/public')));

// MongoDB Connection
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://rajesh:rajesh@cluster0.cqkgbx3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    console.error("Server will not function without a database connection.");
    process.exit(1); // Exit the application if the database connection fails
  });

// Configure Socket.IO with open CORS
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
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
        {
          lastUpdated: new Date(),
          latitude: latitude,
          longitude: longitude,
        },
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
    console.log("Client disconnected:", socket.id);
  });
});

// API Routes
app.post("/api/register", async (req, res, next) => {
  try {
    const { userId, name, contact, email, password, role } = req.body;

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
    next(err);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide user ID and password!",
      });
    }

    const user = await User.findOne({ userId });
    const ipAddress = getClientIp(req);
    if (!user || password !== user.password) {
      return res.status(401).json({
        status: "fail",
        message: "Incorrect user ID or password",
      });
    }

    user.ipAddress = ipAddress;
    user.lastLogin = new Date();
    await user.save();

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
    next(err);
  }
});

// Reset Password Endpoint
app.post("/api/reset-password", async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide user ID and new password",
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

// User Profile Route
app.get("/api/me/:userId", async (req, res, next) => {
  try {
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

// Bus Management Endpoints
app.post("/api/buses", async (req, res, next) => {
  try {
    const { busNumber, route, driverId, capacity, contactNumber } = req.body;

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
    const buses = await Bus.find();
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
        longitude: parseFloat(longitude),
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

    const trackers = await Tracker.find({ busNumber })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

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

// Route for serving index HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../ICB-Tracking-System-main/public/INDEX/index.html'));
});

// Catch-all route to serve frontend for any route not matching API routes
app.get("*", (req, res) => {
  const urlPath = req.path.substring(1); // Remove the leading slash
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

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Error handling
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
});

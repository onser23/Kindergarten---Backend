require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const Admin = require("./models/Admin");

// Route imports
const authRoutes = require("./routes/auth");
const nannyRoutes = require("./routes/nannies");
const teacherRoutes = require("./routes/teachers");
const groupRoutes = require("./routes/groups");
const eventRoutes = require("./routes/events");
const foodRoutes = require("./routes/foods");
const lessonRoutes = require("./routes/lessons");
const serviceRoutes = require("./routes/services");
const packageRoutes = require("./routes/packages");
const childRoutes = require("./routes/children");

const app = express();

// Database connection
connectDB().then(async () => {
  // Startup: Default admin yoxla/yarat
  try {
    const existingAdmin = await Admin.findOne({ username: "admin" });
    if (!existingAdmin) {
      await Admin.create({
        username: "admin",
        password: "admin123",
        fullName: "Administrator",
        email: "admin@kindergarten.az",
        phone: "+994501234567",
        role: "admin",
      });
      console.log("✅ Default admin yaradıldı (admin / admin123)");
    } else {
      console.log("✅ Admin mövcuddur:", existingAdmin.username);
    }
  } catch (error) {
    console.error("❌ Startup admin yaratma xətası:", error.message);
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/nannies", require("./middleware/auth"), nannyRoutes);
app.use("/api/teachers", require("./middleware/auth"), teacherRoutes);
app.use("/api/groups", require("./middleware/auth"), groupRoutes);
app.use("/api/events", require("./middleware/auth"), eventRoutes);
app.use("/api/foods", require("./middleware/auth"), foodRoutes);
app.use("/api/lessons", require("./middleware/auth"), lessonRoutes);
app.use("/api/services", require("./middleware/auth"), serviceRoutes);
app.use("/api/packages", require("./middleware/auth"), packageRoutes);
app.use("/api/children", require("./middleware/auth"), childRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Baxça İdarəetmə Sistemi API işləyir" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route tapılmadı",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Daxili server xətası",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT} portunda işləyir`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
});

require("dotenv").config();
const http = require('http');
const { Server } = require('socket.io');
const app = require("./app");
const connectDB = require("./config/db");
const { swaggerUi, specs } = require('./config/swagger');
// 1. Database Connection
connectDB();

// 2. Create HTTP Server
const server = http.createServer(app);

// 3. Initialize Socket.io
const io = new Server(server, {
  cors: { origin: "*" } 
});

// 4. Sockets Logic
require('./sockets/chat')(io);
app.set('io', io);

io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`👤 User joined notification room: ${userId}`);
  });
});

// 5. Background Jobs
require('./jobs/inventoryAlertJob');

// 6. Rate Limiting
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
// 6.5 API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
// 7. Route Imports
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const couponRoutes = require("./routes/couponRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const userRoutes = require("./routes/userRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const profileRoutes = require("./routes/profileRoutes");
const notificationService = require('./services/notificationService');
const searchRoutes = require('./routes/searchRoutes');
const reportRoutes = require('./routes/reportRoutes');
// Report Routes
app.use('/api/reports', reportRoutes);
// 8. Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/profile", profileRoutes);
app.use('/api/search', searchRoutes);

// 9. Global Error Handling (Must be last)
const errorHandler = require('./middleware/errorMiddleware');
app.use(errorHandler);

// 10. Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
const mongoose = require("mongoose");
const dns = require("dns");

// Helper to check network connectivity with a tight 1.5s timeout
const isOnline = () => {
  return new Promise((resolve) => {
    dns.lookup("google.com", (err) => resolve(!err));
    setTimeout(() => resolve(false), 1500);
  });
};

const connectDB = async () => {
  try {
    const online = await isOnline();

    if (online) {
      // 1. Try connecting to Atlas Cloud if network is active
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 2000, // Reduced to 2s for instant failover
      });
      console.log(`☁️ Connected to MongoDB Atlas (Cloud): ${conn.connection.host}`);
      return;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error(`❌ Atlas connection failed in production: ${error.message}`);
      throw error;
    }
    console.log(`🌐 Atlas connection failed. Switching to Local DB...`);
  }

  // 2. Fallback to Local MongoDB instantly if offline or Atlas times out
  try {
    const localConn = await mongoose.connect("mongodb://127.0.0.1:27017/gebeyaplusdb", {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`💻 Connected to Local MongoDB (Offline Mode): ${localConn.connection.host}`);
  } catch (localError) {
    console.error(`❌ Local MongoDB connection failed: ${localError.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
const mongoose = require("mongoose");
const dns = require("dns");

// Force Google DNS for Atlas SRV resolution
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
  try {
    // 1. Try connecting to Atlas Cloud (Times out in 4s if offline)
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 4000,
    });
    console.log(`☁️ Connected to MongoDB Atlas (Cloud): ${conn.connection.host}`);
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`❌ Atlas connection failed in production: ${error.message}`);
      throw error;
    }
    console.log(`🌐 Atlas connection unavailable. Switching to Local DB...`);

    try {
      const localConn = await mongoose.connect("mongodb://127.0.0.1:27017/nextcartdb");
      console.log(`💻 Connected to Local MongoDB (Offline Mode): ${localConn.connection.host}`);
    } catch (localError) {
      console.error(`❌ Local MongoDB is not running! Ensure MongoDB service is started.`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
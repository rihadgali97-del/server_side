const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["customer", "vendor", "admin"], default: "customer" },
    settings: { notifications: notificationSchema },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationTokenExpires: Date,

    // Reputation System for Digital Trust
    reputation: {
        score: { type: Number, default: 20, min: 0, max: 100 },
        rank: { type: String, enum: ["New", "Trusted", "Elite", "Legendary"], default: "New" },
        metrics: {
            successfulOrders: { type: Number, default: 0 },
            cancelledOrders: { type: Number, default: 0 },
        }
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
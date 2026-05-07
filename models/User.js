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
    isVerified: { type: Boolean, default: false }, // Matches your 'isEmailVerified' logic
    verificationToken: String,
    verificationTokenExpires: Date,

    // Reputation System for Digital Trust
    reputation: {
        score: { type: Number, default: 20, min: 0, max: 100 },
        // Added 'Starter' and 'Unverified' to match your TrustService logic
        rank: { 
            type: String, 
            enum: ["Unverified", "Starter", "Trusted", "Elite", "Legendary"], 
            default: "Starter" 
        },
        metrics: {
            successfulOrders: { type: Number, default: 0 }, // Use this consistently!
            cancelledOrders: { type: Number, default: 0 },
            totalReviews: { type: Number, default: 0 },
            positiveFeedbackRatio: { type: Number, default: 0 },
            averageDeliveryHours: { type: Number, default: 0 }, // For the Speed Pillar
            lastOrderDate: { type: Date } // For Recency Bias
        }
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
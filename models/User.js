const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true,
        trim: true
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        enum: ["customer", "vendor", "admin"], 
        default: "customer" 
    },
    settings: { 
        notifications: { type: notificationSchema, default: {} } 
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    isVerified: { type: Boolean, default: false }, 
    verificationToken: String,
    verificationTokenExpires: Date,

    // Geospatial Location tracking for Customer proximity matching
    location: {
        type: { 
            type: String, 
            enum: ['Point']
            // REMOVED default: 'Point' to prevent automated indexing crashes
        },
        coordinates: { 
            type: [Number] // [longitude, latitude]
        } 
    },

    // Reputation System for Digital Trust
    reputation: {
        score: { type: Number, default: 20, min: 0, max: 100 },
        rank: { 
            type: String, 
            enum: ["Unverified", "Starter", "Trusted", "Elite", "Legendary"], 
            default: "Starter" 
        },
        metrics: {
            successfulOrders: { type: Number, default: 0 }, 
            cancelledOrders: { type: Number, default: 0 },
            totalReviews: { type: Number, default: 0 },
            positiveFeedbackRatio: { type: Number, default: 0 },
            averageDeliveryHours: { type: Number, default: 0 }, 
            lastOrderDate: { type: Date } 
        }
    }
}, { timestamps: true });

// Create geospatial index for efficient proximity searches
userSchema.index({ location: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("User", userSchema);
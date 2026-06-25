const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  businessName: { type: String, required: true },
  description: { type: String },
  businessAddress: {
    street: String, city: String, state: String, zipCode: String, country: String
  },
  // Geospatial Location tracking for calculating distance to customers
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  contactEmail: { type: String },
  contactPhone: { type: String },
  
  // 🛠️ NEW: Added Fayda and License tracking alongside Tax ID
  taxId: { type: String },
  faydaNumber: { type: String },
  licenseNumber: { type: String },
  
  website: { type: String },
  logo: { type: String },
  isVerified: { type: Boolean, default: false },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 0.1 },

  // Reputation System for Digital Trust
  reputation: {
    score: { type: Number, default: 20, min: 0, max: 100 },
    rank: { type: String, enum: ["New", "Verified", "Top-Rated", "Legendary"], default: "New" },
    metrics: {
      successfulFulfillments: { type: Number, default: 0 },
      cancelledByVendor: { type: Number, default: 0 },
    }
  },

  verification: {
    status: { 
      type: String, 
      enum: ['pending', 'verified', 'rejected', 'unsubmitted'], 
      default: 'unsubmitted' 
    },
    documents: [{
      // 🛠️ NEW: Added 'fayda_card' to the allowed document types
      type: { type: String, enum: ['trade_license', 'tin_certificate', 'id_card', 'fayda_card'] },
      fileUrl: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
    rejectionReason: String,
    verifiedAt: Date
  },

  payoutInfo: {
    method: { type: String, enum: ['bank', 'wallet'], default: 'bank' },
    bankDetails: { accountNumber: String, routingNumber: String, bankName: String, accountHolderName: String },
    walletDetails: { walletAddress: String, walletType: String }
  }
}, { timestamps: true });

vendorSchema.index({ businessName: 1 });
// Create geospatial index for calculating shortest delivery paths
vendorSchema.index({ location: "2dsphere" });

module.exports = mongoose.model('Vendor', vendorSchema);
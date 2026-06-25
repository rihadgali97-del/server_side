const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }, 
        image: { type: String },
        vendor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        // Financial Split Snapshots (calculated at checkout checkout)
        vendorEarnings: { type: Number, required: true }, 
        commissionAmount: { type: Number, required: true } 
      }
    ],
    shippingAddress: { type: Object, required: true },
    totalPrice: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["telebirr", "stripe", "wallet", "cbe", "cash"], // Clean, standardized lowercase enums
      default: "cash",
      lowercase: true // Automatically converts strings like "Telebirr" to "telebirr" before validating
    },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered"],
      default: "pending",
      lowercase: true
    }
  },
  { timestamps: true }
);

// --- INDEXES FOR PERFORMANCE OPTIMIZATION ---

// 1. Fast lookup for customer order history
orderSchema.index({ user: 1 });

// 2. Fast lookup for multi-vendor dashboards/sales data
orderSchema.index({ "orderItems.vendor": 1 });

// 3. Fast extraction for financial reporting audits
orderSchema.index({ createdAt: -1 });

// --------------------------------------------

module.exports = mongoose.model("Order", orderSchema);
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
        price: { type: Number, required: true }, // Original price
        image: { type: String },
        vendor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        // 🔥 Pro Feature: Financial Tracking
        vendorEarnings: { type: Number, required: true }, // Price * Quantity * 0.90
        commissionAmount: { type: Number, required: true } // Price * Quantity * 0.10
      }
    ],
    shippingAddress: { type: Object, required: true },
    totalPrice: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["telebirr","Telebirr","Stripe","Wallet","cbe", "cash", "stripe"],
      default: "cash"
    },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered"],
      default: "pending"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
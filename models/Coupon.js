const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: {
    type:      String,
    required:  true,
    unique:    true,
    uppercase: true,
    trim:      true,
  },
  discountType: {
    type:     String,
    enum:     ["percentage", "fixed"],
    required: true,
  },
  value: {
    type:     Number,
    required: true,
    min:      0,
  },
  minOrderAmount: {
    type:    Number,
    default: 0,
  },
  maxDiscount: {           // cap on percentage discounts (e.g. max 200 ETB off)
    type:    Number,
    default: null,
  },
  maxUses: {               // total uses allowed (null = unlimited)
    type:    Number,
    default: null,
  },
  usedCount: {
    type:    Number,
    default: 0,
  },
  usedBy: [{               // track which users already used it
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User",
  }],
  expiryDate: {
    type: Date,
  },
  isActive: {
    type:    Boolean,
    default: true,
  },
  createdBy: {             // admin or vendor user ID
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User",
  },
  createdByRole: {         // "admin" or "vendor"
    type:    String,
    enum:    ["admin", "vendor"],
    default: "admin",
  },
  vendor: {                // if vendor coupon — scoped to that vendor's products only
    type:    mongoose.Schema.Types.ObjectId,
    ref:     "Vendor",
    default: null,
  },
  description: {
    type:    String,
    default: "",
  },
}, { timestamps: true });

// ── Indexes ────────────────────────────────────────────────────────────────────
couponSchema.index({ code: 1 });
couponSchema.index({ vendor: 1 });
couponSchema.index({ expiryDate: 1 });

// ── Instance method: validate coupon for an order ──────────────────────────────
couponSchema.methods.validate = function(userId, orderAmount) {
  if (!this.isActive)
    return { valid: false, message: "This coupon is inactive" };

  if (this.expiryDate && new Date() > this.expiryDate)
    return { valid: false, message: "This coupon has expired" };

  if (this.maxUses !== null && this.usedCount >= this.maxUses)
    return { valid: false, message: "This coupon has reached its usage limit" };

  if (this.usedBy.map(id => id.toString()).includes(userId.toString()))
    return { valid: false, message: "You have already used this coupon" };

  if (orderAmount < this.minOrderAmount)
    return { valid: false, message: `Minimum order amount is ${this.minOrderAmount} ETB` };

  return { valid: true };
};

// ── Instance method: calculate discount amount ─────────────────────────────────
couponSchema.methods.calcDiscount = function(orderAmount) {
  if (this.discountType === "percentage") {
    const raw = (orderAmount * this.value) / 100;
    return this.maxDiscount ? Math.min(raw, this.maxDiscount) : raw;
  }
  return Math.min(this.value, orderAmount); // fixed — never exceed order total
};

module.exports = mongoose.model("Coupon", couponSchema);
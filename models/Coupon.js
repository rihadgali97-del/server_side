const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: String,
  discountType: {
    type: String,
    enum: ["percentage", "fixed"]
  },
  value: Number,
  minOrderAmount: Number,
  expiryDate: Date
});

module.exports = mongoose.model("Coupon", couponSchema);
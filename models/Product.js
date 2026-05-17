const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    image: { type: String },
    lowStockThreshold: { type: Number, default: 5 },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: true
    },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    variants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant'
    }],
    tags: [String]
  },
  { timestamps: true }
);

// Compound text index for Trust-Weighted Search
productSchema.index({ 
  name: 'text', 
  description: 'text', 
  tags: 'text' 
}, {
  weights: {
    name: 10,       
    tags: 5,        
    description: 2  
  }
});

module.exports = mongoose.model("Product", productSchema);
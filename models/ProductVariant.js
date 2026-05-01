const mongoose = require('mongoose');

const productVariantSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    size: {
        type: String,
        required: true
    },
    color: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0
    },
    price: {
        type: Number,
        default: null // If null, use product's price
    },
    sku: {
        type: String,
        unique: true
    },
    image: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('ProductVariant', productVariantSchema);

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order' // Optional, for reviews after purchase
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        maxlength: 100
    },
    comment: {
        type: String,
        required: true,
        maxlength: 1000
    },
    images: [{
        type: String // URLs to review images
    }],
    isVerified: {
        type: Boolean,
        default: false // Verified purchase review
    },
    helpful: {
        type: Number,
        default: 0
    },
    reported: {
        type: Boolean,
        default: false
    },
    reportReason: {
        type: String
    },
    response: {
        text: String,
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        respondedAt: Date
    }
}, { timestamps: true });

// Index for efficient queries
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // One review per user per product

// Static method to calculate average rating for a product
reviewSchema.statics.getAverageRating = async function(productId) {
    const result = await this.aggregate([
        { $match: { product: productId } },
        {
            $group: {
                _id: '$product',
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 }
            }
        }
    ]);

    return result[0] || { averageRating: 0, totalReviews: 0 };
};

// Pre-save middleware to update product's average rating
reviewSchema.post('save', async function() {
    const Product = mongoose.model('Product');
    const stats = await this.constructor.getAverageRating(this.product);

    await Product.findByIdAndUpdate(this.product, {
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews
    });
});

// Pre-remove middleware to update product's average rating
reviewSchema.pre('remove', async function() {
    const Product = mongoose.model('Product');
    const stats = await this.constructor.getAverageRating(this.product);

    await Product.findByIdAndUpdate(this.product, {
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews
    });
});

module.exports = mongoose.model('Review', reviewSchema);

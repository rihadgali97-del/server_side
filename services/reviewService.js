const Review = require('../models/Review');
const Product = require('../models/Product');

// Helper for pagination
const buildPagination = (page, limit) => {
    const currentPage = Number(page) || 1;
    const pageSize = Number(limit) || 10;
    const skip = (currentPage - 1) * pageSize;
    return { currentPage, pageSize, skip };
};

const createNewReview = async (userId, data) => {
    const { productId, rating, comment, title, images, orderId } = data;

    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const existingReview = await Review.findOne({ product: productId, user: userId });
    if (existingReview) throw new Error('You have already reviewed this product');

    return await Review.create({
        user: userId,
        product: productId,
        order: orderId,
        rating,
        title,
        comment,
        images
    });
};

const fetchReviews = async (query) => {
    const { userId, reported, productId, page, limit } = query;
    const { currentPage, pageSize, skip } = buildPagination(page, limit);

    const filter = {};
    if (productId) filter.product = productId;
    if (userId) filter.user = userId;
    if (reported === 'true') filter.reported = true;
    if (reported === 'false') filter.reported = false;

    const reviews = await Review.find(filter)
        .populate('user', 'name email')
        .populate('product', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

    const total = await Review.countDocuments(filter);
    return { reviews, total, currentPage, pageSize };
};

const fetchReviewById = async (id) => {
    return await Review.findById(id)
        .populate('user', 'name email')
        .populate('product', 'name price');
};

const updateReviewData = async (reviewId, userId, userRole, updateBody) => {
    const review = await Review.findById(reviewId);
    if (!review) throw new Error('Review not found');

    // Authorization check
    if (review.user.toString() !== userId && userRole !== 'admin') {
        throw new Error('Not authorized to update this review');
    }

    const { rating, title, comment, images } = updateBody;
    review.rating = rating || review.rating;
    review.title = title || review.title;
    review.comment = comment || review.comment;
    review.images = images || review.images;

    return await review.save();
};

const removeReview = async (reviewId, userId, userRole) => {
    const review = await Review.findById(reviewId);
    if (!review) throw new Error('Review not found');

    if (review.user.toString() !== userId && userRole !== 'admin') {
        throw new Error('Not authorized to delete this review');
    }

    return await review.deleteOne(); // .remove() is deprecated in newer Mongoose versions
};

const setReportStatus = async (id, isReported, reason = '') => {
    const review = await Review.findById(id);
    if (!review) throw new Error('Review not found');

    review.reported = isReported;
    review.reportReason = isReported ? (reason || 'No reason provided') : '';
    return await review.save();
};

module.exports = {
    createNewReview,
    fetchReviews,
    fetchReviewById,
    updateReviewData,
    removeReview,
    setReportStatus
};
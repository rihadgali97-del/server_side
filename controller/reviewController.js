const reviewService = require('../services/reviewService');

exports.createReview = async (req, res) => {
    try {
        const { productId, rating, comment } = req.body;
        if (!productId || !rating || !comment) {
            return res.status(400).json({ success: false, message: 'Product, rating, and comment are required' });
        }

        const review = await reviewService.createNewReview(req.user.id, req.body);
        res.status(201).json({ success: true, data: review });
    } catch (error) {
        const statusCode = error.message === 'Product not found' ? 404 : 400;
        res.status(statusCode).json({ success: false, message: error.message });
    }
};

exports.getReviews = async (req, res) => {
    try {
        const { reviews, total, currentPage, pageSize } = await reviewService.fetchReviews({
            ...req.query,
            productId: req.query.productId || req.params.productId
        });

        res.json({
            success: true,
            data: reviews,
            pagination: {
                page: currentPage,
                limit: pageSize,
                total,
                pages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching reviews' });
    }
};

exports.getReviewById = async (req, res) => {
    try {
        const review = await reviewService.fetchReviewById(req.params.id);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
        res.json({ success: true, data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching review' });
    }
};

exports.getMyReviews = async (req, res) => {
    try {
        const { reviews, total, currentPage, pageSize } = await reviewService.fetchReviews({
            userId: req.user.id,
            page: req.query.page,
            limit: req.query.limit
        });

        res.json({
            success: true,
            data: reviews,
            pagination: { page: currentPage, limit: pageSize, total, pages: Math.ceil(total / pageSize) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching your reviews' });
    }
};

exports.updateReview = async (req, res) => {
    try {
        const review = await reviewService.updateReviewData(req.params.id, req.user.id, req.user.role, req.body);
        res.json({ success: true, data: review });
    } catch (error) {
        const status = error.message.includes('authorized') ? 403 : 404;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        await reviewService.removeReview(req.params.id, req.user.id, req.user.role);
        res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
        const status = error.message.includes('authorized') ? 403 : 404;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.reportReview = async (req, res) => {
    try {
        const review = await reviewService.setReportStatus(req.params.id, true, req.body.reason);
        res.json({ success: true, data: review });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.clearReport = async (req, res) => {
    try {
        const review = await reviewService.setReportStatus(req.params.id, false);
        res.json({ success: true, data: review });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};
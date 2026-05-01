const express = require('express');
const router = express.Router();
const {
    createReview,
    getReviews,
    getReviewById,
    getMyReviews,
    updateReview,
    deleteReview,
    reportReview,
    clearReport
} = require('../controller/reviewController');

const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

/**
 * @openapi
 * tags:
 *   name: Reviews
 *   description: Product reviews, ratings, and content moderation
 */

/**
 * @openapi
 * /api/reviews:
 *   get:
 *     summary: Get all reviews
 *     tags: [Reviews]
 *   post:
 *     summary: Create a new product review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product, rating, comment]
 *             properties:
 *               product: { type: string, description: "Product ID" }
 *               rating: { type: number, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 */
router.get('/', getReviews);
router.post('/', protect, createReview);

/**
 * @openapi
 * /api/reviews/product/{productId}:
 *   get:
 *     summary: Get all reviews for a specific product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 */
router.get('/product/:productId', getReviews);

/**
 * @openapi
 * /api/reviews/mine:
 *   get:
 *     summary: Get reviews written by the logged-in user
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.get('/mine', protect, getMyReviews);

/**
 * @openapi
 * /api/reviews/{id}:
 *   get:
 *     summary: Get a specific review by ID
 *     tags: [Reviews]
 *   put:
 *     summary: Update a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', getReviewById);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

/**
 * @openapi
 * /api/reviews/{id}/report:
 *   put:
 *     summary: Report a review for moderation
 *     description: Flag a review for administrative review (e.g., spam or abuse).
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/report', protect, reportReview);

/**
 * @openapi
 * /api/reviews/{id}/clear:
 *   put:
 *     summary: Clear reports on a review (Admin Only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/clear', protect, requireAdmin, clearReport);
module.exports = router;
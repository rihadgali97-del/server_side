const express = require("express");
const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Coupons
 *   description: Promotional codes and discount management
 */

const { createCoupon } = require("../controller/couponController");

/**
 * @openapi
 * /api/coupons:
 *   post:
 *     summary: Create a new discount coupon
 *     description: |
 *       Generates a promotional code that can be applied at checkout.
 *       Supports percentage-based or flat-rate discounts.
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discountType, amount, expiryDate]
 *             properties:
 *               code:
 *                 type: string
 *                 example: "SAVE20"
 *                 description: "The unique alphanumeric code users enter at checkout."
 *               discountType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *                 example: "percentage"
 *               amount:
 *                 type: number
 *                 example: 20
 *                 description: "The value of the discount (e.g., 20 for 20%)."
 *               expiryDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-31"
 *               usageLimit:
 *                 type: integer
 *                 example: 100
 *                 description: "Total number of times this coupon can be used."
 *     responses:
 *       201:
 *         description: Coupon created successfully
 *       400:
 *         description: Invalid coupon data or code already exists
 *       401:
 *         description: Unauthorized - Token required
 */
router.post("/", createCoupon);

module.exports = router;
const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
} = require("../controller/orderController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

/**
 * @openapi
 * tags:
 *   name: Orders
 *   description: Order management, checkout process, and fulfillment tracking
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 60d21b4667d0d8992e610c85
 *         orderItems:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               product: { type: string, description: "Product ID" }
 *               quantity: { type: integer }
 *               price: { type: number }
 *               vendor: { type: string, description: "Vendor ID" }
 *         totalPrice:
 *           type: number
 *           example: 299.99
 *         status:
 *           type: string
 *           enum: [pending, processing, shipped, delivered, cancelled]
 *           example: pending
 */

// Base path: /api/orders

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: Create a new order (Checkout)
 *     description: Processes the current cart and creates a pending order.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       201:
 *         description: Order created successfully
 *   get:
 *     summary: Get logged-in user's orders
 *     description: Returns a list of all orders placed by the current user.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of orders retrieved
 */
router.post("/", protect, createOrder);
router.get("/", protect, getOrders);

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     summary: Get order details by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order details found
 *       404:
 *         description: Order not found
 */
router.get("/:id", protect, getOrderById);

/**
 * @openapi
 * /api/orders/{id}/status:
 *   put:
 *     summary: Update order status (Admin/Vendor Only)
 *     description: Updates the status of an order. Setting status to "delivered" triggers the Vendor Rank check and performance stats update.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [processing, shipped, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Status updated and rank checked
 */
router.put("/:id/status", protect, authorizeRoles("admin", "vendor"), updateOrderStatus);

module.exports = router;
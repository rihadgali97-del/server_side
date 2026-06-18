const express = require('express');
const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Vendors
 *   description: Vendor dashboard, inventory management, and financial tracking
 */

const {
  getVendorStats,
  getVendorProfile,
  updateVendorProfile,
  getVendorProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getVendorOrders,
  updateOrderStatus,
  getVendorWallet,
  getVendorTransactions
} = require('../controller/vendorController');

const { protect } = require('../middleware/authMiddleware');
const { requireVendor } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Global Middleware for Vendor Routes
router.use(protect);
router.use(requireVendor());

/**
 * @openapi
 * /api/vendors/stats:
 *   get:
 *     summary: Get vendor performance dashboard statistics
 *     description: Returns revenue, sales count, and calculates current rank (Silver, Gold, etc.).
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRevenue: { type: number, example: 5400.50 }
 *                 totalItemsSold: { type: integer, example: 120 }
 *                 rank: { type: string, example: 'Gold Seller' }
 */
router.get('/stats', getVendorStats);

/**
 * @openapi
 * /api/vendors/profile:
 *   get:
 *     summary: View vendor business profile
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *   put:
 *     summary: Update vendor business details
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessName: { type: string }
 *               contactEmail: { type: string }
 *               businessAddress: { type: string }
 */
router.get('/profile', getVendorProfile);
router.put('/profile', updateVendorProfile);

/**
 * @openapi
 * /api/vendors/products:
 *   get:
 *     summary: List all products belonging to this vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of products
 *   post:
 *     summary: Add a new product to inventory
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, stock, category]
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *               stock: { type: integer }
 *               category: { type: string, description: 'Category ID' }
 */
router.get('/products', getVendorProducts);
router.post('/products', upload.single('image'), addProduct);

/**
 * @openapi
 * /api/vendors/products/{id}:
 *   put:
 *     summary: Update product details
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     summary: Remove a product from the store
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     security:
 *       - bearerAuth: []
 */
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

/**
 * @openapi
 * /api/vendors/orders:
 *   get:
 *     summary: View all orders containing this vendor's products
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.get('/orders', getVendorOrders);

/**
 * @openapi
 * /api/vendors/orders/{id}/status:
 *   put:
 *     summary: Update status of a specific order
 *     description: Changing status to "delivered" triggers the Vendor Rank check.
 *     tags: [Vendors]
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
 *               status: { type: string, enum: [processing, shipped, delivered, cancelled] }
 *     security:
 *       - bearerAuth: []
 */
router.put('/orders/:id/status', updateOrderStatus);

/**
 * @openapi
 * /api/vendors/wallet:
 *   get:
 *     summary: Get current balance and wallet details
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.get('/wallet', getVendorWallet);

/**
 * @openapi
 * /api/vendors/transactions:
 *   get:
 *     summary: Get transaction history (payouts and earnings)
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.get('/transactions', getVendorTransactions);

module.exports = router;
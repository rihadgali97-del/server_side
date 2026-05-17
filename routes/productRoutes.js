const express = require("express");
const router = express.Router();
const { protect, isEmailVerified, isApprovedVendor } = require("../middleware/authMiddleware"); 
const upload = require("../middleware/uploadMiddleware");

/**
 * @openapi
 * tags:
 *   name: Products
 *   description: Public product catalog and vendor inventory management
 */

const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  searchProducts
} = require("../controller/productController");

/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: Get all products
 *     description: Retrieve a paginated list of products with optional filters for categories or search terms.
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/", getProducts);
router.get("/search", searchProducts);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Get a single product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product found
 *       404:
 *         description: Product not found
 */
router.get("/:id", getProduct);

/**
 * @openapi
 * /api/products:
 *   post:
 *     summary: Create a new product (Vendors Only)
 *     description: Uploads a product image and saves details. Requires an approved vendor account.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, price, stock, category, image]
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *               stock: { type: integer }
 *               category: { type: string }
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Product created
 *       403:
 *         description: Not an approved vendor or email not verified
 */
router.post(
  "/", 
  protect, 
  isEmailVerified, 
  isApprovedVendor, 
  upload.single('image'), 
  createProduct
);

/**
 * @openapi
 * /api/products/{id}:
 *   put:
 *     summary: Update product details
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *               stock: { type: integer }
 *     responses:
 *       200:
 *         description: Product updated
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product deleted
 */
router.put("/:id", protect, isApprovedVendor, updateProduct);
router.delete("/:id", protect, isApprovedVendor, deleteProduct);

module.exports = router;
const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

/**
 * @openapi
 * tags:
 *   name: Categories
 *   description: Product categorization and taxonomy management
 */

// Import your auth middlewares
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

/**
 * @openapi
 * /api/categories:
 *   post:
 *     summary: Create a new category (Admin Only)
 *     description: Adds a new classification for products. Prevents duplicate category names.
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Electronics
 *               description:
 *                 type: string
 *                 example: Gadgets, hardware, and electronic components
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Category already exists
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post("/", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const { name } = req.body;
    const existingCategory = await Category.findOne({ name });
    
    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     description: Returns a list of all available product categories. Public access.
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   name: { type: string }
 *                   description: { type: string }
 */
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
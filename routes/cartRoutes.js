const express = require("express");
const router = express.Router();
const {
  addToCart,
  getCart,
  removeFromCart,
  clearCart // Add this import
} = require("../controller/cartController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, addToCart);
router.get("/", protect, getCart);
router.delete("/", protect, clearCart); // Added this: DELETE /api/cart
router.delete("/:productId", protect, removeFromCart);

module.exports = router;
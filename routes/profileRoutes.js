const express = require("express");
const {
  getProfile,
  updateProfile,
  changePassword,
  updateNotifications,
} = require("../controller/profileController.js");

const { protect } = require("../middleware/authMiddleware.js");

const router = express.Router();

// Profile
router.get("/", protect, getProfile);
router.put("/", protect, updateProfile);

// changing Password
router.put("/change-password", protect, changePassword);

// Notifications
router.put("/notifications", protect, updateNotifications);

module.exports = router;
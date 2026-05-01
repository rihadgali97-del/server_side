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
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

// Password
router.put("/password", protect, changePassword);

// Notifications
router.put("/notifications", protect, updateNotifications);

module.exports = router;
const express = require('express');
const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Settings
 *   description: Personal profile, vendor business settings, and administrative system configurations
 */

const {
  getUserProfile,
  updateUserProfile,
  changePassword,
  getVendorSettings,
  updateVendorSettings,
  getAdminSettings,
  updateAdminSettings
} = require('../controller/settingsController');

const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// --- User Settings Routes ---

/**
 * @openapi
 * /api/settings/profile:
 *   get:
 *     summary: Retrieve user profile settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile settings retrieved
 *   put:
 *     summary: Update user profile settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 */
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

/**
 * @openapi
 * /api/settings/password:
 *   put:
 *     summary: Change user password
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password }
 *               newPassword: { type: string, format: password }
 */
router.put('/password', protect, changePassword);

// --- Vendor Settings Routes ---

/**
 * @openapi
 * /api/settings/vendor:
 *   get:
 *     summary: Get vendor-specific business settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor settings retrieved
 *   put:
 *     summary: Update vendor business settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/vendor', protect, requireRole('vendor'), getVendorSettings);
router.put('/vendor', protect, requireRole('vendor'), updateVendorSettings);

// --- Admin Settings Routes ---

/**
 * @openapi
 * /api/settings/admin:
 *   get:
 *     summary: Get system-wide administrative settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin settings retrieved
 *   put:
 *     summary: Update global system configurations
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin', protect, requireRole('admin'), getAdminSettings);
router.put('/admin', protect, requireRole('admin'), updateAdminSettings);

module.exports = router;
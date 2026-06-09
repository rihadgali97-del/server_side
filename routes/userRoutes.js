const express = require('express');
const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Users
 *   description: User account management, administrative controls, and financial records
 */

const {
  getProfile,
  updateProfile,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserWallet,
  getUserTransactions,
  updateLocationControllerMethod
} = require('../controller/userController');

const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// --- Profile Routes ---

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     summary: Get current logged-in user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
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
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

// --- Admin & User Management Routes ---

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all users (Admin Only)
 *     description: Retrieve a full list of registered users. Requires administrative privileges.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/', protect, requireAdmin, getUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get specific user details by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User found
 *   put:
 *     summary: Update a user's role or status (Admin Only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User updated successfully
 *   delete:
 *     summary: Delete a user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 */
router.get('/:id', protect, getUserById);
router.put('/:id', protect, requireAdmin, updateUser);
router.delete('/:id', protect, deleteUser);

/**
 * @openapi
 * /api/users/{id}/wallet:
 *   get:
 *     summary: Get user's wallet balance
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Wallet details retrieved
 */
router.get('/:id/wallet', protect, getUserWallet);

/**
 * @openapi
 * /api/users/{id}/transactions:
 *   get:
 *     summary: Get user's transaction history
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Transaction list retrieved
 */
router.get('/:id/transactions', protect, getUserTransactions);
router.put('/location', protect, async (req, res, next) => {
    try {
        const { longitude, latitude } = req.body;

        if (longitude === undefined || latitude === undefined) {
            return res.status(400).json({ 
                success: false, 
                message: "Latitude and Longitude parameters are mandatory." 
            });
        }

        if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid GPS coordinate boundary ranges." 
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                location: {
                    type: "Point",
                    coordinates: [parseFloat(longitude), parseFloat(latitude)] // [longitude, latitude]
                }
            },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Your delivery location has been successfully synchronized!",
            location: updatedUser.location
        });
    } catch (error) {
        next(error); // Passes the error smoothly to your global error middleware
    }
});

module.exports = router;
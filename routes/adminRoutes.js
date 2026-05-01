const express = require('express');
const router = express.Router();

const {
    getDashboardStats,
    getUsers,
    updateUser,
    deleteUser,
    getVendors,
    verifyVendor, // We will use this for the status toggle
    getProducts,
    updateProduct,
    deleteProduct,
    getOrders,
    updateOrderStatus,
    getReviews,
    moderateReview,
    getAuditLogs
} = require('../controller/adminController');

const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// All routes require authentication and admin role
router.use(protect);
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', getDashboardStats);

// User management
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Vendor management
router.get('/vendors', getVendors);
router.put('/vendors/:id/verify', verifyVendor);

// Fixed: Changed function name to verifyVendor to match the import above
router.put('/vendors/:id/status', verifyVendor); 

// Product management
router.get('/products', getProducts);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Order management
router.get('/orders', getOrders);
router.put('/orders/:id/status', updateOrderStatus);

// Review moderation
router.get('/reviews', getReviews);
router.put('/reviews/:id/moderate', moderateReview);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
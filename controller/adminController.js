const adminService = require('../services/adminService');

const getDashboardStats = async (req, res) => {
    try {
        const stats = await adminService.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { users, total } = await adminService.fetchUsers(page, limit);
        res.json({ success: true, data: users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
};

const updateUser = async (req, res) => {
    try {
        const user = await adminService.updateUserData(req.params.id, req.body);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating user' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const user = await adminService.removeUser(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
};

const getVendors = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { vendors, total } = await adminService.fetchVendors(page, limit);
        res.json({ success: true, data: vendors, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching vendors' });
    }
};

const verifyVendor = async (req, res) => {
    try {
        const vendor = await adminService.processVendorVerification(req.params.id, req.body, req.user._id, req.ip);
        if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
        res.json({ success: true, message: `Vendor ${req.body.status} successfully`, data: vendor });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error processing verification' });
    }
};

const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { products, total } = await adminService.fetchProducts(page, limit);
        res.json({ success: true, data: products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching products' });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product = await adminService.updateProductData(req.params.id, req.body);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating product' });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await adminService.removeProduct(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting product' });
    }
};

const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { orders, total } = await adminService.fetchOrders(page, limit);
        res.json({ success: true, data: orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const order = await adminService.modifyOrderStatus(req.params.id, req.body.status);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating order status' });
    }
};

const getReviews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { reviews, total } = await adminService.fetchReportedReviews(page, limit);
        res.json({ success: true, data: reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching reviews' });
    }
};

const moderateReview = async (req, res) => {
    try {
        const result = await adminService.processReviewModeration(req.params.id, req.body.action);
        if (req.body.action === 'remove') {
            return res.json({ success: true, message: 'Review removed successfully' });
        } else {
            return res.json({ success: true, message: 'Review approved', data: result });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error moderating review' });
    }
};

const getAuditLogs = async (req, res) => {
    try {
        const logs = await adminService.fetchAuditLogs();
        res.status(200).json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateAdminSettings = async (req, res) => {
    try {
        const updatedSettings = await adminService.modifyAdminSettings(req.body, req.user._id, req.ip);
        res.status(200).json({ success: true, data: updatedSettings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getDashboardStats,
    getUsers,
    updateUser,
    deleteUser,
    getVendors,
    verifyVendor,
    getProducts,
    updateProduct,
    deleteProduct,
    getOrders,
    updateOrderStatus,
    getReviews,
    moderateReview,
    getAuditLogs,
    updateAdminSettings 
};
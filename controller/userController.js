const userService = require('../services/userService');

// Helper to check if the requester has permission to access/modify a specific user ID
const checkAccess = (req, targetUserId) => {
    if (req.user.role !== 'admin' && req.user.id !== targetUserId.toString()) {
        throw new Error('Access denied');
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await userService.findUserById(req.user.id);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const user = await userService.updateUserData(req.user.id, { name, email });
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(error.message === 'User not found' ? 404 : 500).json({ success: false, message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { name, email, role } = req.body;
        const user = await userService.updateUserData(req.params.id, { name, email, role });
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(error.message === 'User not found' ? 404 : 500).json({ success: false, message: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const result = await userService.fetchPaginatedUsers(req.query.page, req.query.limit);
        res.json({
            success: true,
            data: result.users,
            pagination: {
                page: result.currentPage,
                limit: result.pageSize,
                total: result.total,
                pages: result.totalPages
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await userService.findUserById(req.params.id);
        checkAccess(req, user._id);
        res.json({ success: true, data: user });
    } catch (error) {
        const status = error.message === 'Access denied' ? 403 : 404;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        checkAccess(req, req.params.id);
        await userService.removeUserAccount(req.params.id);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        const status = error.message === 'Access denied' ? 403 : 404;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.getUserWallet = async (req, res) => {
    try {
        checkAccess(req, req.params.id);
        const wallet = await userService.fetchWalletWithHistory(req.params.id);
        res.json({ success: true, data: wallet });
    } catch (error) {
        const status = error.message === 'Access denied' ? 403 : 404;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.getUserTransactions = async (req, res) => {
    try {
        checkAccess(req, req.params.id);
        const result = await userService.fetchPaginatedTransactions(
            req.params.id, 
            req.query.page, 
            req.query.limit
        );
        res.json({
            success: true,
            data: result.transactions,
            pagination: {
                page: result.currentPage,
                limit: result.pageSize,
                total: result.total,
                pages: result.totalPages
            }
        });
    } catch (error) {
        const status = error.message === 'Access denied' ? 403 : 404;
        res.status(status).json({ success: false, message: error.message });
    }
};
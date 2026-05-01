const settingsService = require('../services/settingsService');

// User Settings
exports.getUserProfile = async (req, res) => {
    try {
        const user = await settingsService.fetchUserProfile(req.user.id);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const user = await settingsService.updateUserProfileData(req.user.id, req.body);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(error.message === 'User not found' ? 404 : 500).json({ success: false, message: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Old and new passwords are required' });
        }

        await settingsService.processPasswordChange(req.user.id, oldPassword, newPassword);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        const status = error.message.includes('incorrect') ? 400 : 404;
        res.status(status).json({ success: false, message: error.message });
    }
};

// Vendor Settings
exports.getVendorSettings = async (req, res) => {
    try {
        const vendor = await settingsService.fetchVendorData(req.user.id);
        res.json({ success: true, data: vendor });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.updateVendorSettings = async (req, res) => {
    try {
        const vendor = await settingsService.updateVendorData(req.user.id, req.body);
        res.json({ success: true, data: vendor });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

// Admin Settings
exports.getAdminSettings = async (req, res) => {
    try {
        const settings = await settingsService.fetchAdminGlobalSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching admin settings' });
    }
};

exports.updateAdminSettings = async (req, res) => {
    try {
        const settings = await settingsService.updateAdminGlobalSettings(req.body);
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating admin settings' });
    }
};
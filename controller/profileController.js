const profileService = require("../services/profileService");

exports.getProfile = async (req, res) => {
    try {
        const user = await profileService.fetchUserById(req.user.id);
        res.json(user);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const updatedData = await profileService.updateBasicProfile(req.user.id, req.body);
        res.json({
            message: "Profile updated",
            user: updatedData
        });
    } catch (error) {
        res.status(error.message === "User not found" ? 404 : 500).json({ message: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "Both old and new passwords are required" });
        }

        await profileService.updateSecuritySettings(req.user.id, oldPassword, newPassword);
        res.json({ message: "Password updated successfully" });
    } catch (error) {
        const status = error.message === "Old password is incorrect" ? 400 : 404;
        res.status(status).json({ message: error.message });
    }
};

exports.updateNotifications = async (req, res) => {
    try {
        const notifications = await profileService.updateNotificationPrefs(req.user.id, req.body);
        res.json({
            message: "Notification settings updated",
            notifications
        });
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};
const User = require("../models/User");
const bcrypt = require("bcryptjs");

const fetchUserById = async (userId) => {
    const user = await User.findById(userId).select("-password");
    if (!user) throw new Error("User not found");
    return user;
};

const updateBasicProfile = async (userId, { name, email }) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    user.name = name || user.name;
    user.email = email || user.email;

    const updatedUser = await user.save();
    return {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email
    };
};

const updateSecuritySettings = async (userId, oldPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new Error("Old password is incorrect");

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    return await user.save();
};

const updateNotificationPrefs = async (userId, { email, push }) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // Ensure nested objects exist
    if (!user.settings) user.settings = {};
    if (!user.settings.notifications) user.settings.notifications = {};

    // Update values if defined
    if (email !== undefined) user.settings.notifications.email = email;
    if (push !== undefined) user.settings.notifications.push = push;

    await user.save();
    return user.settings.notifications;
};

module.exports = {
    fetchUserById,
    updateBasicProfile,
    updateSecuritySettings,
    updateNotificationPrefs
};
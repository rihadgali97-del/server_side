const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Settings = require('../models/Settings');
const bcrypt = require('bcryptjs');

// --- USER SERVICES ---
const fetchUserProfile = async (userId) => {
    const user = await User.findById(userId).select('-password');
    if (!user) throw new Error('User not found');
    return user;
};

const updateUserProfileData = async (userId, body) => {
    const { name, email, notificationPreferences } = body;
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (name) user.name = name;
    if (email) user.email = email;

    if (notificationPreferences) {
        if (typeof notificationPreferences.email === 'boolean') {
            user.notificationPreferences.email = notificationPreferences.email;
        }
        if (typeof notificationPreferences.push === 'boolean') {
            user.notificationPreferences.push = notificationPreferences.push;
        }
    }

    await user.save();
    const userResponse = user.toObject();
    delete userResponse.password;
    return userResponse;
};

const processPasswordChange = async (userId, oldPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new Error('Old password is incorrect');

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    return await user.save();
};

// --- VENDOR SERVICES ---
const fetchVendorData = async (userId) => {
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) throw new Error('Vendor profile not found');
    return vendor;
};

const updateVendorData = async (userId, body) => {
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) throw new Error('Vendor profile not found');

    const fieldsToUpdate = ['businessName', 'description', 'contactEmail', 'contactPhone', 'taxId', 'website', 'logo'];
    fieldsToUpdate.forEach(field => {
        if (body[field] !== undefined) vendor[field] = body[field];
    });

    if (body.businessAddress) {
        vendor.businessAddress = { ...vendor.businessAddress, ...body.businessAddress };
    }

    if (body.payoutInfo) {
        if (body.payoutInfo.method) vendor.payoutInfo.method = body.payoutInfo.method;
        if (body.payoutInfo.bankDetails) {
            vendor.payoutInfo.bankDetails = { ...vendor.payoutInfo.bankDetails, ...body.payoutInfo.bankDetails };
        }
        if (body.payoutInfo.walletDetails) {
            vendor.payoutInfo.walletDetails = { ...vendor.payoutInfo.walletDetails, ...body.payoutInfo.walletDetails };
        }
    }

    return await vendor.save();
};

// --- ADMIN SERVICES ---
const fetchAdminGlobalSettings = async () => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await Settings.create({});
    }
    return settings;
};

const updateAdminGlobalSettings = async (body) => {
    const { commissionRate, defaultCurrency, globalConfigurations } = body;
    let settings = await Settings.findOne() || new Settings();

    if (commissionRate !== undefined) settings.commissionRate = commissionRate;
    if (defaultCurrency) settings.defaultCurrency = defaultCurrency;
    if (globalConfigurations) {
        settings.globalConfigurations = { ...settings.globalConfigurations, ...globalConfigurations };
    }

    return await settings.save();
};

module.exports = {
    fetchUserProfile,
    updateUserProfileData,
    processPasswordChange,
    fetchVendorData,
    updateVendorData,
    fetchAdminGlobalSettings,
    updateAdminGlobalSettings
};
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');

const getStats = async () => {
    const [
        totalUsers,
        totalVendors,
        totalProducts,
        totalOrders,
        revenueStats,
        pendingOrders,
        lowStockProducts
    ] = await Promise.all([
        User.countDocuments({ role: 'customer' }),
        Vendor.countDocuments(),
        Product.countDocuments(),
        Order.countDocuments(),
        Order.aggregate([
            { $match: { isPaid: true } },
            { 
                $group: { 
                    _id: null, 
                    totalGross: { $sum: '$totalPrice' },
                    totalCommission: { $sum: { 
                        $reduce: {
                            input: "$orderItems",
                            initialValue: 0,
                            in: { $add: ["$$value", { $ifNull: ["$$this.commissionAmount", 0] }] }
                        }
                    }}
                } 
            }
        ]),
        Order.countDocuments({ status: { $in: ['pending', 'processing'] } }),
        Product.countDocuments({ stock: { $lt: 10 } })
    ]);

    const recentOrders = await Order.find()
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('totalPrice status createdAt');

    const topProducts = await Product.find()
        .sort({ totalReviews: -1 })
        .limit(5)
        .select('name totalReviews averageRating');

    const monthlyRevenue = await Order.aggregate([
        {
            $match: {
                isPaid: true,
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$totalPrice' }
            }
        }
    ]);

    return {
        counts: {
            users: totalUsers,
            vendors: totalVendors,
            products: totalProducts,
            orders: totalOrders,
            grossRevenue: revenueStats[0]?.totalGross || 0,
            platformProfit: revenueStats[0]?.totalCommission || 0,
            pendingOrders,
            lowStockProducts
        },
        recentOrders,
        topProducts,
        monthlyRevenue: monthlyRevenue[0]?.total || 0
    };
};

const fetchUsers = async (page, limit) => {
    const skip = (page - 1) * limit;
    const users = await User.find({ role: 'customer' })
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await User.countDocuments({ role: 'customer' });
    return { users, total };
};

const updateUserData = async (id, data) => {
    return await User.findByIdAndUpdate(id, data, { new: true }).select('-password');
};

const removeUser = async (id) => {
    return await User.findByIdAndDelete(id);
};

const fetchVendors = async (page, limit) => {
    const skip = (page - 1) * limit;
    const vendors = await Vendor.find()
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await Vendor.countDocuments();
    return { vendors, total };
};

const processVendorVerification = async (id, body, adminId, ip) => {
    const { status, rejectionReason } = body;
    const updateData = {
        isVerified: status === 'verified',
        'verification.status': status,
        'verification.verifiedAt': status === 'verified' ? Date.now() : null,
        'verification.rejectionReason': status === 'rejected' ? rejectionReason : null
    };

    if (status === 'verified') {
        updateData['reputation.rank'] = 'Verified';
        updateData['reputation.score'] = 40;
    }

    const vendor = await Vendor.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (vendor) {
        await AuditLog.create({
            adminId,
            action: 'VERIFY_VENDOR',
            target: vendor.businessName,
            details: `Status set to: ${status}`,
            ipAddress: ip || '0.0.0.0'
        });
    }
    return vendor;
};

const fetchProducts = async (page, limit) => {
    const skip = (page - 1) * limit;
    const products = await Product.find()
        .populate('category', 'name')
        .populate('vendor', 'businessName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await Product.countDocuments();
    return { products, total };
};

const updateProductData = async (id, data) => {
    return await Product.findByIdAndUpdate(id, data, { new: true });
};

const removeProduct = async (id) => {
    return await Product.findByIdAndDelete(id);
};

const fetchOrders = async (page, limit) => {
    const skip = (page - 1) * limit;
    const orders = await Order.find()
        .populate('user', 'name email')
        .populate('orderItems.product', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await Order.countDocuments();
    return { orders, total };
};

const modifyOrderStatus = async (id, status) => {
    return await Order.findByIdAndUpdate(id, { status }, { new: true });
};

const fetchReportedReviews = async (page, limit) => {
    const skip = (page - 1) * limit;
    const reviews = await Review.find({ reported: true })
        .populate('user', 'name')
        .populate('product', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await Review.countDocuments({ reported: true });
    return { reviews, total };
};

const processReviewModeration = async (id, action) => {
    if (action === 'remove') {
        return await Review.findByIdAndDelete(id);
    } else {
        return await Review.findByIdAndUpdate(id, { reported: false }, { new: true });
    }
};

const fetchAuditLogs = async () => {
    return await AuditLog.find().populate('adminId', 'name email').sort({ timestamp: -1 }).limit(100);
};

const modifyAdminSettings = async (data, adminId, ip) => {
    const updatedSettings = await Settings.findOneAndUpdate({}, data, { upsert: true, new: true });
    await AuditLog.create({
        adminId,
        action: 'UPDATE_SYSTEM_CONFIG',
        target: 'Global Settings',
        details: `Config updated by admin`,
        ipAddress: ip || '0.0.0.0'
    });
    return updatedSettings;
};

module.exports = {
    getStats,
    fetchUsers,
    updateUserData,
    removeUser,
    fetchVendors,
    processVendorVerification,
    fetchProducts,
    updateProductData,
    removeProduct,
    fetchOrders,
    modifyOrderStatus,
    fetchReportedReviews,
    processReviewModeration,
    fetchAuditLogs,
    modifyAdminSettings
};
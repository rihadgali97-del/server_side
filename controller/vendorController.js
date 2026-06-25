const Vendor = require('../models/Vendor');
const vendorService = require('../services/VendorService');
const walletService = require('../services/WalletService');
const orderService = require('../services/OrderService');
const productService = require('../services/productService');
const getPagination = (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

// Dashboard Stats
exports.getVendorStats = async (req, res) => {
    try {
        const data = await vendorService.getStats(req.user._id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Profile Logic
exports.getVendorProfile = async (req, res) => {
    res.json({ success: true, data: req.vendor });
};

exports.updateVendorProfile = async (req, res) => {
    try {
        // Intercept profile changes to format incoming location updates into GeoJSON Point objects
        if (req.body.longitude !== undefined && req.body.latitude !== undefined) {
            req.body.location = {
                type: 'Point',
                coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
            };
        } else if (req.body.lng !== undefined && req.body.lat !== undefined) {
            req.body.location = {
                type: 'Point',
                coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)]
            };
        }

        const updatedVendor = await vendorService.updateProfile(req.vendor, req.body);
        res.json({ success: true, data: updatedVendor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Inventory (Products)
exports.getVendorProducts = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const result = await vendorService.getProducts(req.user._id, { skip, pageSize: limit });
        res.json({ 
            success: true, 
            data: result.products, 
            pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addProduct = async (req, res) => {
    try {
        const filePath = req.file ? req.file.path : null;
        const io = req.app.get("io");

        // 🛠️ DIAGNOSTIC LOG: See exactly who is logged in vs the database structure
        console.log("-----------------------------------------");
        console.log("🕵️‍♂️ Authenticated User ID from Token:", req.user._id);
        console.log("🕵️‍♂️ Full Authenticated User Object:", req.user);
        console.log("-----------------------------------------");

        const product = await productService.createProduct(req.user._id, req.body, filePath, io);
        
        res.status(201).json({ success: true, data: product });
    } catch (error) {
        console.error("❌ CRASH IN ADD_PRODUCT:", error); 
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const product = await vendorService.updateProduct(req.params.id, req.user._id, req.body);
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await vendorService.deleteProduct(req.params.id, req.user._id);
        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Sales (Orders)
exports.getVendorOrders = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const result = await vendorService.getOrders(req.user._id, { skip, pageSize: limit });
        res.json({ 
            success: true, 
            data: result.orders, 
            pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await orderService.updateStatus(req.params.id, status);

        if (status === 'delivered') {
            const vendorEarnings = order.orderItems
                .filter(i => i.vendor.toString() === req.user._id.toString())
                .reduce((acc, item) => acc + item.vendorEarnings, 0);

            await walletService.releasePendingFunds(req.user._id, vendorEarnings, 'ETB', order._id, "Order Payout");
        }
        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Finance (Wallet)
exports.getVendorWallet = async (req, res) => {
    try {
        const wallet = await walletService.getOrCreateWallet(req.user._id);
        res.json({ success: true, wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getVendorTransactions = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const wallet = await walletService.getOrCreateWallet(req.user._id);
        const { transactions, total } = await vendorService.getTransactions(wallet._id, { skip, pageSize: limit });
        res.json({ success: true, data: transactions, pagination: { page, limit, total } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPublicVendorProfile = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id)
            .select('businessName description logo reputation rating isVerified');

        if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

        const trustMetadata = {
            isHighlyTrusted: vendor.reputation.score > 80,
            badgeColor: vendor.reputation.rank === 'Legendary' ? '#FFD700' : '#4CAF50',
            showVerifiedIcon: vendor.isVerified
        };

        res.json({ success: true, data: vendor, trustMetadata });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getVendorAnalytics = async (req, res) => {
    try {
        const vendorId = req.user._id;

        // 1. Sales Trend (Last 7 Days)
        const salesTrend = await Order.aggregate([
            { $unwind: "$orderItems" },
            { $match: { "orderItems.vendor": vendorId, isPaid: true } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    dailyRevenue: { $sum: "$orderItems.vendorEarnings" },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } },
            { $limit: 7 }
        ]);

        // 2. Category Distribution (Products per category)
        const categoryData = await Product.aggregate([
            { $match: { vendor: vendorId } },
            {
                $group: {
                    _id: "$category",
                    productCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            {
                $project: {
                    name: "$categoryInfo.name",
                    value: "$productCount"
                }
            }
        ]);

        res.json({ success: true, salesTrend, categoryData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
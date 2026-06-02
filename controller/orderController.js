const orderService = require("../services/orderService");
const paymentFactory = require("../services/payment/PaymentFactory");
const notificationService = require("../services/notificationService");
const trustService = require("../services/TrustService"); 
const User = require("../models/User");
const Order = require("../models/Order");

// @desc    Create new order (Kept your original logic)
exports.createOrder = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const result = await orderService.createOrder(req.body, userId);

        let paymentInfo = null;
        if (req.body.paymentMethod !== 'cash') {
            const gateway = paymentFactory.getGateway(req.body.paymentMethod);
            if (gateway) {
                paymentInfo = await gateway.processPayment(result.order, req.body.totalPrice);
            }
        }

        try {
            const io = req.app.get("io");
            const vendorIds = [...new Set(result.order.orderItems.map(item => item.vendor).filter(Boolean))];
            
            for (const vId of vendorIds) {
                const vendorUser = await User.findById(vId);
                if (io && vendorUser) {
                    await notificationService.sendNewOrderNotification({
                        io, vendorEmail: vendorUser.email, userId: vendorUser._id, orderId: result.order._id
                    });
                }
            }
        } catch (notifyError) {
            console.error("Notification Error (Order Created):", notifyError.message);
        }

        res.status(201).json({ success: true, order: result.order, paymentInfo });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update order status and trigger Trust Engine
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await orderService.updateStatus(req.params.id, status);
        const vendorId = order.orderItems[0]?.vendor;

        if (vendorId && (status === 'delivered' || status === 'cancelled')) {
            const vendor = await User.findById(vendorId);
            const currentMetrics = vendor.reputation.metrics;

            if (status === 'delivered') {
                // 1. Calculate Delivery Latency
                const newDeliveryTime = Math.abs(new Date() - new Date(order.createdAt)) / 36e5; // hours
                
                // 2. Moving Average Formula: (OldAvg * Count + NewVal) / (Count + 1)
                const oldCount = currentMetrics.successfulOrders || 0;
                const oldAvg = currentMetrics.averageDeliveryHours || 0;
                const updatedAvg = ((oldAvg * oldCount) + newDeliveryTime) / (oldCount + 1);

                await User.findByIdAndUpdate(vendorId, {
                    $inc: { 'reputation.metrics.successfulOrders': 1 },
                    $set: { 
                        'reputation.metrics.averageDeliveryHours': updatedAvg,
                        'reputation.metrics.lastOrderDate': new Date() 
                    }
                });
            } else if (status === 'cancelled') {
                await User.findByIdAndUpdate(vendorId, {
                    $inc: { 'reputation.metrics.cancelledOrders': 1 },
                    $set: { 'reputation.metrics.lastOrderDate': new Date() }
                });
            }
            
            // Recalculate Trust Score after metrics update
            await trustService.updateTrustScore(vendorId);
        }

        // --- Notification Logic (Unchanged) ---
        try {
            const io = req.app.get("io");
            const customer = await User.findById(order.user);
            if (io && customer) {
                await notificationService.sendOrderStatusNotification({
                    io, userEmail: customer.email, userId: customer._id, orderId: order._id, status
                });
            }
        } catch (err) { console.error("Notify Error:", err.message); }

        res.json({ success: true, order });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all orders for the logged-in user
exports.getOrders = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single order by ID
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("orderItems.product")
            .populate("user", "name email reputation");

        if (!order) return res.status(404).json({ message: "Order not found" });

        const userId = req.user._id || req.user.id;
        const isOwner = order.user._id.toString() === userId.toString();
        const isAdmin = req.user.role === 'admin';
        const isVendorOfItem = order.orderItems.some(item => item.vendor?.toString() === userId.toString());

        if (!isOwner && !isAdmin && !isVendorOfItem) {
            return res.status(401).json({ message: "Not authorized" });
        }

        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getVendorOrders = async (req, res) => {
    try {
        const orders = await orderService.getVendorOrders(req.user._id);
        res.status(200).json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
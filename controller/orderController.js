const Order          = require('../models/Order');
const Product        = require('../models/Product');
const Vendor         = require('../models/Vendor');
const User           = require('../models/User');
const Coupon         = require('../models/Coupon');
const emailService   = require('../services/emailService');
const paymentFactory = require('../services/payment/PaymentFactory');
const notificationService = require('../services/notificationService');
const trustService   = require('../services/trustService');

const DEFAULT_COMMISSION_RATE = 0.10; // 10% platform commission default

// ─── Helper: send email non-blocking ──────────────────────────────────────────
const sendEmail = (fn, ...args) => {
  Promise.resolve().then(() => fn(...args)).catch(err =>
    console.error('📧 Email error:', err.message)
  );
};

// ─── POST /api/orders ─────────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const {
      orderItems, shippingAddress, paymentMethod,
      totalPrice, couponCode, discount = 0,
    } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items' });
    }

    // 1. Process & compute required fields (commissionAmount & vendorEarnings)
    const processedOrderItems = orderItems.map((item) => {
      const itemPrice = Number(item.price || 0);
      const itemQty = Number(item.quantity || 1);
      const itemTotal = itemPrice * itemQty;

      const commissionRate = item.commissionRate ?? DEFAULT_COMMISSION_RATE;
      const commissionAmount = +(itemTotal * commissionRate).toFixed(2);
      const vendorEarnings = +(itemTotal - commissionAmount).toFixed(2);

      return {
        ...item,
        commissionRate,
        commissionAmount,
        vendorEarnings,
      };
    });

    // 2. Apply coupon if present
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (coupon) {
        coupon.usedCount += 1;
        if (!coupon.usedBy.includes(req.user._id)) {
          coupon.usedBy.push(req.user._id);
        }
        await coupon.save();
      }
    }

    // 3. Create Order document
    const order = await Order.create({
      user: req.user._id,
      orderItems: processedOrderItems,
      shippingAddress,
      paymentMethod,
      totalPrice,
      discount,
      couponCode: couponCode || null,
      isPaid: false,
    });

    // 4. Handle Payment Gateway if not Cash
    let paymentInfo = null;
    if (paymentMethod && paymentMethod !== 'cash') {
      const gateway = paymentFactory.getGateway(paymentMethod);
      if (gateway) {
        paymentInfo = await gateway.processPayment(order, totalPrice);
      }
    }

    const populated = await Order.findById(order._id)
      .populate('user', 'name email')
      .populate('orderItems.vendor', 'businessName user');

    // 5. Send Non-blocking Emails & Notifications
    const customer = await User.findById(req.user._id);
    if (customer) {
      sendEmail(emailService.sendOrderConfirmation, populated, customer);
    }

    const vendorIds = [...new Set(
      processedOrderItems.map(i => i.vendor?.toString()).filter(Boolean)
    )];

    const io = req.app.get("io");
    for (const vid of vendorIds) {
      const vendor = await Vendor.findById(vid);
      const vendorUser = vendor ? await User.findById(vendor.user) : null;
      
      // Email Notification
      if (vendor && vendorUser) {
        sendEmail(emailService.sendVendorNewOrderAlert, vendor, vendorUser, populated);
      }

      // Socket / Push Notification
      if (io && vendorUser) {
        try {
          await notificationService.sendNewOrderNotification({
            io, 
            vendorEmail: vendorUser.email, 
            userId: vendorUser._id, 
            orderId: order._id 
          });
        } catch (notifyErr) {
          console.error("Notification Error:", notifyErr.message);
        }
      }
    }

    res.status(201).json({ success: true, order: populated, paymentInfo });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /api/orders/:id/status ───────────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.status = status;
    if (status === 'delivered') { 
      order.isDelivered = true; 
      order.deliveredAt = new Date(); 
    }
    await order.save();

    // ── Trust Engine Update Logic ──────────────────────────────────────────────
    const vendorId = order.orderItems[0]?.vendor;
    if (vendorId && (status === 'delivered' || status === 'cancelled')) {
      const vendorUser = await User.findById(vendorId);
      if (vendorUser && vendorUser.reputation) {
        const currentMetrics = vendorUser.reputation.metrics || {};

        if (status === 'delivered') {
          const newDeliveryTime = Math.abs(new Date() - new Date(order.createdAt)) / 36e5; // hours
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
        
        await trustService.updateTrustScore(vendorId);
      }
    }

    // ── Non-blocking Notifications ──────────────────────────────────────────────
    if (order.user) {
      sendEmail(emailService.sendOrderStatusUpdate, order, order.user, status);

      const io = req.app.get("io");
      if (io) {
        try {
          await notificationService.sendOrderStatusNotification({
            io, 
            userEmail: order.user.email, 
            userId: order.user._id, 
            orderId: order._id, 
            status 
          });
        } catch (err) {
          console.error("Notify Error:", err.message);
        }
      }
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/orders ──────────────────────────────────────────────────────────
exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = req.user.role === 'admin' ? {} : { user: req.user._id };
    if (status) query.status = status;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email reputation')
      .populate('orderItems.product')
      .populate('orderItems.vendor', 'businessName location city');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const userId = req.user._id || req.user.id;
    const isOwner = order.user._id.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    const isVendorOfItem = order.orderItems.some(item => 
      item.vendor?._id?.toString() === userId.toString() || item.vendor?.toString() === userId.toString()
    );

    if (!isOwner && !isAdmin && !isVendorOfItem) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/orders/vendor ───────────────────────────────────────────────────
exports.getVendorOrders = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const orders = await Order.find({ 'orderItems.vendor': vendor._id })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
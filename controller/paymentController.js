const Order       = require('../models/Order');
const Transaction = require('../models/Transaction');
const Wallet      = require('../models/Wallet');
const telebirrService = require('../services/payment/telebirrService');

const DEFAULT_CURRENCY = 'ETB';
const gatewayRegistry  = new Map();

const registerGateway = (name, adapter) => {
  if (!name || !adapter || typeof adapter.charge !== 'function') {
    throw new Error('Gateway adapter must include a charge method');
  }
  gatewayRegistry.set(name.toLowerCase(), adapter);
};

const getGateway = (name) => {
  const provider = gatewayRegistry.get(name.toLowerCase());
  if (!provider) throw new Error(`Payment provider not supported: ${name}`);
  return provider;
};

const baseGatewayAdapter = (name) => ({
  charge: async ({ order }) => ({
    success: true,
    provider: name,
    transactionId: `${name.toUpperCase()}-${Date.now()}`,
    status: 'completed',
    metadata: { orderId: order._id.toString() }
  }),
  refund: async () => ({
    success: true,
    transactionId: `${name.toUpperCase()}-REFUND-${Date.now()}`,
    status: 'completed'
  })
});

registerGateway('cash',   baseGatewayAdapter('cash'));
registerGateway('cbe',    baseGatewayAdapter('cbe'));
registerGateway('stripe', baseGatewayAdapter('stripe'));

registerGateway('telebirr', {
  charge: async ({ order }) => {
    try {
      const response = await telebirrService.createTelebirrOrder(order);
      return {
        success:       true,
        status:        'pending',
        transactionId: order._id.toString(),
        metadata:      { paymentUrl: response.url }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
  refund: async () => ({ success: false, error: 'Telebirr refunds must be processed manually via the Fabric dashboard.' })
});

const resolveWallet = async (userId) => {
  if (userId) {
    const userWallet = await Wallet.findOne({ user: userId });
    if (userWallet) return userWallet;
  }
  const fallback = await Wallet.findOne();
  if (fallback) return fallback;
  throw new Error('No active system ledger wallet target located.');
};

// @desc    Telebirr — initiate payment, return checkout URL to the frontend
// @route   POST /api/payments/initiate-telebirr
// @access  Protected
exports.initiateTelebirrPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.isPaid) {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    const provider     = getGateway('telebirr');
    const paymentResult = await provider.charge({ order });

    if (!paymentResult.success) {
      return res.status(400).json({ success: false, message: paymentResult.error || 'Payment initiation failed' });
    }

    const wallet = await resolveWallet(req.user?._id);

    const existing = await Transaction.findOne({
      reference:     orderId.toString(),
      referenceType: 'payment',
      status:        'pending'
    });

    if (!existing) {
      await Transaction.create({
        wallet:        wallet._id,
        type:          'deposit',
        amount:        order.totalPrice || 0,
        currency:      DEFAULT_CURRENCY,
        description:   `Initiated Telebirr payment for order ${order._id}`,
        reference:     order._id.toString(),
        referenceType: 'payment',
        status:        'pending',
        metadata:      { provider: 'telebirr', ...paymentResult.metadata },
        processedAt:   new Date()
      });
    }

    return res.status(200).json({
      success: true,
      url:     paymentResult.metadata.paymentUrl
    });
  } catch (error) {
    console.error('❌ initiateTelebirrPayment error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Telebirr — receive and process the async payment notification
// @route   POST /api/payments/telebirr-webhook
// @access  Public 
exports.telebirrWebhook = async (req, res) => {
  try {
    let payload = null;

    if (req.body.msgtxt) {
      payload = telebirrService.decryptNotifyData(req.body.msgtxt);
    } else if (req.body.biz_content) {
      payload = typeof req.body.biz_content === 'string'
        ? JSON.parse(req.body.biz_content)
        : req.body.biz_content;
    } else {
      payload = req.body;
    }

    const outTradeNo = payload?.out_trade_no || payload?.outTradeNo || payload?.merch_order_id;

    const isSuccess =
      payload?.status === 'success'         || 
      payload?.code   === '200'             || 
      payload?.trade_status === 'Trade_Success';

    if (outTradeNo && isSuccess) {
      const order = await Order.findById(outTradeNo);

      if (order && !order.isPaid) {
        order.isPaid       = true;
        order.paidAt       = new Date();
        order.paymentMethod = 'telebirr';
        order.status       = 'processing';
        await order.save();

        await Transaction.findOneAndUpdate(
          { reference: order._id.toString(), referenceType: 'payment', status: 'pending' },
          { status: 'completed', processedAt: new Date() }
        );

        console.log(`✅ Telebirr payment confirmed for order ${order._id}`);
      }
    } else {
      console.warn('⚠️ Telebirr webhook received non-success payload:', JSON.stringify(payload));
    }

    return res.status(200).json({ code: 0, message: 'success' });
  } catch (error) {
    console.error('❌ telebirrWebhook error:', error.message);
    return res.status(200).json({ code: 1, message: 'internal error' });
  }
};

// @desc    General — get order payment summary + transaction history
// @route   GET /api/payments/:id/summary
// @access  Protected
exports.getPaymentSummary = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const transactions = await Transaction.find({
      reference:     req.params.id,
      referenceType: 'payment'
    }).sort({ createdAt: -1 });

    return res.status(200).json({ order, transactions });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Stripe — create payment intent
// @route   POST /api/payments/create-payment-intent
// @access  Protected
exports.createPaymentIntent = async (req, res) => {
  try {
    return res.status(200).json({ success: true, clientSecret: 'mock_stripe_secret' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Stripe — webhook receiver
// @route   POST /api/payments/webhook
// @access  Public
exports.stripeWebhook = async (req, res) => {
  try {
    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Stripe — manual payment verification
// @route   PUT /api/payments/verify/:id
// @access  Protected
exports.verifyPayment = async (req, res) => {
  try {
    return res.status(200).json({ success: true, status: 'completed' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
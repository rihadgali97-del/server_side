const mongoose    = require('mongoose'); // Required for atomic session-driven checkouts
const Order       = require('../models/Order');
const Transaction = require('../models/Transaction');
const Wallet      = require('../models/Wallet');
const telebirrService = require('../services/payment/telebirrService');
const WalletService   = require('../services/WalletService'); // Interacts with internal balance ledger tier
const notificationService = require('../services/notificationService'); 

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

// Registering active payment modes
registerGateway('cash',   baseGatewayAdapter('cash'));
registerGateway('cbe',    baseGatewayAdapter('cbe'));

// Telebirr Native Hub Integration
registerGateway('telebirr', {
  charge: async ({ order }) => {
    try {
      // -----------------------------------------------------------------------
      // 🔌 OPTION A: LOCAL DEVELOPMENT MOCK (Active by default for sandbox testing)
      // -----------------------------------------------------------------------
      console.log(`⚠️ Telebirr Mock Bypass Active: Simulating gateway link for Tracking Reference #${order._id}`);
      return {
        success:       true,
        status:        'pending',
        transactionId: order._id.toString(),
        metadata:      { paymentUrl: `http://localhost:3000/mock-checkout?orderId=${order._id}&amt=${order.totalPrice}` }
      };

      // -----------------------------------------------------------------------
      // 🚀 OPTION B: LIVE PRODUCTION / SANDBOX HUB (Uncomment when connection issues clear up)
      // -----------------------------------------------------------------------
      /*
      const response = await telebirrService.createTelebirrOrder(order);
      return {
        success:       true,
        status:        'pending',
        transactionId: order._id.toString(),
        metadata:      { paymentUrl: response.url }
      };
      */
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
      // 🛠️ heavily populate core user relational data for the dynamic email wrappers
      const order = await Order.findById(outTradeNo).populate('user');

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

        // ── DISPATCH TRANSACTION DISPATCH HANDSHAKE (NON-CRASHING) ──
        try {
          const io = req.app.get('io');
          // Fallback array mapping to guarantee notification architecture compatibility
          order.orderItems = order.orderItems || order.items || [];
          
          await notificationService.sendPaymentSuccessNotification({
            io,
            order,
            user: order.user,
            amount: order.totalPrice || 0,
            currency: order.currency || DEFAULT_CURRENCY
          });
        } catch (notifError) {
          console.error('⚠️ Webhook transaction notification bypass caught:', notifError.message);
        }

      } else if (outTradeNo.startsWith('DEP-')) {
        // Fallback processing node for internal standalone user deposits
        const pendingTx = await Transaction.findOne({
          reference: outTradeNo,
          referenceType: 'deposit',
          status: 'pending'
        });

        if (pendingTx) {
          pendingTx.status = 'completed';
          await pendingTx.save();

          await WalletService.creditAvailableFunds(
            pendingTx.wallet,
            pendingTx.amount,
            pendingTx.currency,
            outTradeNo
          );
          console.log(`✅ Telebirr direct wallet load processed successfully for tracking: ${outTradeNo}`);
        }
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

// @desc    Telebirr — Initiate standalone wallet balance load
// @route   POST /api/payments/initiate-wallet-deposit
// @access  Protected
exports.initiateWalletDeposit = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'A valid deposit amount is required' });
    }

    const wallet = await resolveWallet(req.user?._id);
    const depositTrackingId = `DEP-${wallet._id}-${Date.now()}`;

    const ephemeralOrderPayload = {
      _id: depositTrackingId,
      totalPrice: Number(amount)
    };

    const provider = getGateway('telebirr');
    const paymentResult = await provider.charge({ order: ephemeralOrderPayload });

    if (!paymentResult.success) {
      return res.status(400).json({ success: false, message: paymentResult.error || 'Gateway interaction failed' });
    }

    await Transaction.create({
      wallet: wallet._id,
      type: 'deposit',
      amount: Number(amount),
      currency: DEFAULT_CURRENCY,
      description: `Pending wallet deposit top-up validation request`,
      reference: depositTrackingId,
      referenceType: 'deposit',
      status: 'pending',
      metadata: { provider: 'telebirr', ...paymentResult.metadata }
    });

    return res.status(200).json({
      success: true,
      url: paymentResult.metadata.paymentUrl
    });
  } catch (error) {
    console.error('❌ initiateWalletDeposit error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Checkout — Pay for an order using internal wallet available balance
// @route   POST /api/payments/pay-with-wallet
// @access  Protected
exports.payWithWallet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.body;
    const userId = req.user?._id;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== userId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Unauthorized to settle this order' });
    }

    if (order.isPaid) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'This order has already been settled' });
    }

    const orderAmount = order.totalPrice || 0;
    const currency = order.currency || DEFAULT_CURRENCY;

    // Fetch user wallet document inside transactional boundary session
    const buyerWallet = await WalletService.getOrCreateWallet(userId, session, false);
    
    if (!buyerWallet.isActive || buyerWallet.isFrozen) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Your wallet is currently inactive or frozen' });
    }

    const currentAvailableBalance = buyerWallet.balances.get(currency) || 0;
    if (currentAvailableBalance < orderAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient wallet balance. Required: ${orderAmount} ${currency}, Available: ${currentAvailableBalance} ${currency}` 
      });
    }

    // Deduct total amount from balance map
    buyerWallet.balances.set(currency, currentAvailableBalance - orderAmount);
    await buyerWallet.save({ session });

    // Generate immediate ledger debit entry row
    const checkoutTxRef = `WLT-PAY-${order._id}-${Date.now()}`;
    await Transaction.create([{
      wallet: buyerWallet._id,
      amount: orderAmount,
      currency: currency,
      type: 'debit',
      description: `Internal wallet checkout settlement for Order #${order._id}`,
      reference: order._id.toString(),
      referenceType: 'order',
      status: 'completed'
    }], { session });

    // Route money into vendor pending escrow buffer space allocation pools
    if (order.vendor) {
      await WalletService.addPendingFunds(order.vendor, orderAmount, currency, session, true);
    } else if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const targetVendor = item.vendor || item.vendorId;
        if (targetVendor) {
          const itemShare = (item.price * item.quantity);
          await WalletService.addPendingFunds(targetVendor, itemShare, currency, session, true);
        }
      }
    }

    // Finalize order status indicators
    order.isPaid = true;
    order.paidAt = new Date();
    order.paymentMethod = 'wallet';
    order.status = 'processing';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // ── DISPATCH WALLET TRANSACTION DISPATCH HANDSHAKE (NON-CRASHING POST-COMMIT) ──
    try {
      const io = req.app.get('io');
      const fullyPopulatedOrder = await Order.findById(orderId).populate('user');
      if (fullyPopulatedOrder && fullyPopulatedOrder.user) {
        fullyPopulatedOrder.orderItems = fullyPopulatedOrder.orderItems || fullyPopulatedOrder.items || [];
        
        await notificationService.sendPaymentSuccessNotification({
          io,
          order: fullyPopulatedOrder,
          user: fullyPopulatedOrder.user,
          amount: orderAmount,
          currency: currency
        });
      }
    } catch (notifError) {
      console.error('⚠️ Wallet transactional checkout notification bypass caught:', notifError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Order paid successfully using internal wallet balance',
      transactionReference: checkoutTxRef,
      remainingBalance: buyerWallet.balances.get(currency)
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ payWithWallet Critical Execution Exception:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

//     General — get order payment summary + transaction history
//    GET /api/payments/:id/summary
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

// =========================================================================
// 💡 MOCKED STUBS FOR STRIPE (Safeguards against UI breakdown)
// =========================================================================

// @desc    Stripe — Mocked payment intent creation
// @route   POST /api/payments/create-payment-intent
exports.createPaymentIntent = async (req, res) => {
  return res.status(200).json({ success: true, clientSecret: 'mock_stripe_disabled_by_user' });
};

// @desc    Stripe — Mocked webhook placeholder receiver
// @route   POST /api/payments/webhook
exports.stripeWebhook = async (req, res) => {
  return res.status(200).json({ received: true, note: 'Stripe functionality skipped' });
};

// @route   PUT /api/payments/verify/:id
exports.verifyPayment = async (req, res) => {
  return res.status(200).json({ success: true, status: 'completed', message: 'Stripe simulation verified' });
};
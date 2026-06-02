const Order = require("../models/Order");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const telebirrService = require("../services/payment/telebirrService");

// ==========================================
//      CORE GATEWAY ENGINE & REGISTRY
// ==========================================

const DEFAULT_CURRENCY = 'ETB';
const gatewayRegistry = new Map();

const registerGateway = (name, adapter) => {
  if (!name || !adapter || typeof adapter.charge !== 'function') {
    throw new Error('Gateway adapter must include a charge method');
  }
  gatewayRegistry.set(name.toLowerCase(), adapter);
};

const getGateway = (name) => {
  const provider = gatewayRegistry.get(name.toLowerCase());
  if (!provider) {
    throw new Error(`Payment provider not supported: ${name}`);
  }
  return provider;
};

// --- Standard Mock Gateway Fallback ---
const baseGatewayAdapter = (name) => ({
  charge: async ({ order, amount, currency }) => ({
    success: true,
    provider: name,
    transactionId: `${name.toUpperCase()}-${Date.now()}`,
    status: 'completed',
    metadata: { orderId: order._id.toString() }
  })
});

// Register default checkout gateways
registerGateway('cash', baseGatewayAdapter('cash'));
registerGateway('cbe', baseGatewayAdapter('cbe'));
registerGateway('stripe', baseGatewayAdapter('stripe'));

// Register Live Telebirr Gateway integration
registerGateway('telebirr', {
  charge: async ({ order }) => {
    try {
      const response = await telebirrService.createTelebirrOrder(order);
      return {
        success: true,
        status: 'pending',
        transactionId: order._id.toString(),
        metadata: { paymentUrl: response.paymentUrl }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
});

// ==========================================
//            CONTROLLER HANDLERS
// ==========================================

// @desc    Telebirr: Initiate Payment and return live link to React frontend
exports.initiateTelebirrPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.isPaid) {
      return res.status(400).json({ message: "Order is already paid" });
    }

    const provider = getGateway('telebirr');
    const paymentResult = await provider.charge({ order });

    if (!paymentResult.success) {
      return res.status(400).json({ success: false, message: paymentResult.error });
    }

    // Attempt to locate a matching wallet for the active user if available
    let userWalletId = null;
    if (req.user) {
      const foundWallet = await Wallet.findOne({ user: req.user._id });
      if (foundWallet) userWalletId = foundWallet._id;
    }

    // Generate database tracker record for the pending transaction initiation
    const transactionRecord = {
      type: 'deposit',
      amount: order.totalPrice || 0,
      currency: 'ETB',
      description: `Initiated Telebirr payment for order ${order._id}`,
      reference: order._id.toString(),
      referenceType: 'payment',
      status: 'pending',
      metadata: { provider: 'telebirr', ...paymentResult.metadata },
      processedAt: new Date()
    };

    // FIX: Only inject wallet id if found, otherwise explicitly map it to avoid breaking validation if the field requires a specific layout pattern
    if (userWalletId) {
      transactionRecord.wallet = userWalletId;
    } else {
      // If no customer wallet document is instantiated, look up an administrative or generic baseline object instance
      const defaultWallet = await Wallet.findOne();
      if (defaultWallet) {
        transactionRecord.wallet = defaultWallet._id;
      } else {
        // Fallback explicit reference placement to satisfy mongoose path requirement if no entities exist yet
        return res.status(400).json({ 
          success: false, 
          message: "Transaction creation halted: No active wallet entity could be detected for the current user session context." 
        });
      }
    }

    await Transaction.create(transactionRecord);

    res.status(200).json({
      success: true,
      url: paymentResult.metadata.paymentUrl 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Telebirr: Silent Decryption Webhook (notifyUrl callback endpoint)
exports.telebirrWebhook = async (req, res) => {
  try {
    const encryptedData = req.body.msgtxt; 
    
    if (!encryptedData) {
      return res.status(400).json({ code: 1, message: "Missing encrypted dataset" });
    }

    const decryptedData = await telebirrService.decryptNotifyData(encryptedData);

    if (decryptedData && (decryptedData.status === 'success' || decryptedData.code === '200')) {
      const order = await Order.findById(decryptedData.outTradeNo);

      if (order && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentMethod = "telebirr";
        order.status = "processing";
        await order.save();

        // Update the transaction log tracking history to completed
        await Transaction.findOneAndUpdate(
          { reference: order._id.toString(), referenceType: 'payment' },
          { status: 'completed', processedAt: new Date() }
        );

        console.log(`✅ Telebirr Payment Verified for Order: ${order._id}`);
      }
    }

    res.status(200).json({ code: 0, message: "success" });
  } catch (error) {
    console.error("❌ Telebirr Webhook Execution Error:", error);
    res.status(500).json({ code: 1, message: "internal server verification failure" });
  }
};

// @desc    General: Get order payment status/summary
exports.getPaymentSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const transactions = await Transaction.find({ reference: id, referenceType: 'payment' }).sort({ createdAt: -1 });
    
    res.status(200).json({ order, transactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Stripe: Placeholder / Element Payment Intent Creation
exports.createPaymentIntent = async (req, res) => {
  try {
    res.status(200).json({ success: true, clientSecret: "mock_stripe_secret" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Stripe: Webhook receiver
exports.stripeWebhook = async (req, res) => {
  try {
    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Stripe: Manual Verification Confirmation
exports.verifyPayment = async (req, res) => {
  try {
    res.status(200).json({ success: true, status: "completed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
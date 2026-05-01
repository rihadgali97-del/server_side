const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/Order");
const telebirrService = require("../services/payment/telebirrService");

/**
 * STRIPE LOGIC
 */

// @desc    Create Stripe Payment Intent
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100), // Stripe expects cents
      currency: "usd",
      metadata: { orderId: order._id.toString() },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Stripe Payment manually (Frontend calls this)
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    
    const order = await Order.findById(req.params.id).populate("items.product");

    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: paymentIntentId,
        status: "succeeded",
      };
      
      order.status = "processing";

      const updatedOrder = await order.save();
      res.status(200).json(updatedOrder);
    } else {
      res.status(404).json({ message: "Order not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * TELEBIRR LOGIC
 */

// @desc    Initiate Telebirr Payment and get Redirect URL
exports.initiateTelebirrPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Call our telebirr service to handle RSA encryption
    const response = await telebirrService.createTelebirrOrder(order);

    res.status(200).json({
      success: true,
      url: response.paymentUrl, // Frontend will use window.location.href = url
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Telebirr Webhook (NotifyUrl) - Telebirr hits this silently
exports.telebirrWebhook = async (req, res) => {
  try {
    // Telebirr sends an encrypted string in the body
    const encryptedData = req.body.msgtxt; 
    
    // Decrypt and verify the data using our service
    const decryptedData = await telebirrService.decryptNotifyData(encryptedData);

    if (decryptedData && decryptedData.status === 'success') {
      const order = await Order.findById(decryptedData.outTradeNo);

      if (order && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
          id: decryptedData.transactionNo,
          status: "succeeded",
        };
        order.status = "processing";
        await order.save();
      }
    }

    // Telebirr requires a specific JSON response to stop retrying the notification
    res.status(200).json({ code: 0, message: "success" });
  } catch (error) {
    console.error("Telebirr Webhook Error:", error);
    res.status(500).json({ code: 1, message: "fail" });
  }
};

/**
 * GENERAL LOGIC
 */

// @desc    Placeholder for Stripe Webhook
exports.stripeWebhook = async (req, res) => {
  res.status(200).json({ received: true });
};

// @desc    Get Payment Summary
exports.getPaymentSummary = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select("totalPrice isPaid status");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
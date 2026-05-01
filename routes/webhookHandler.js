const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/Order");

module.exports = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // In this specific route, req.body IS the raw Buffer because of express.raw()
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`⚠️  Webhook Signature Verification Failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payment
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const orderId = paymentIntent.metadata.orderId;

    try {
      const order = await Order.findById(orderId);
      if (order) {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.status = "processing";
        order.paymentResult = {
          id: paymentIntent.id,
          status: paymentIntent.status,
          email: paymentIntent.receipt_email,
        };
        await order.save();
        console.log(`✅ Order ${orderId} marked PAID successfully.`);
      }
    } catch (dbError) {
      console.error("❌ Database Update Error:", dbError);
    }
  }

  res.json({ received: true });
};
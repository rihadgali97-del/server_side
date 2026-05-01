const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeGateway {
  async processPayment(order, totalPrice) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalPrice * 100), // Stripe uses cents
        currency: 'usd',
        metadata: { orderId: order._id.toString() },
        automatic_payment_methods: { enabled: true },
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        transactionId: paymentIntent.id,
        paymentMethod: 'stripe'
      };
    } catch (error) {
      console.error("❌ Stripe Gateway Error:", error.message);
      throw new Error("Stripe initialization failed");
    }
  }

  // We will add the verify/webhook logic here later
}

module.exports = new StripeGateway();
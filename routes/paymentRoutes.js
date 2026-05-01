const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { 
  createPaymentIntent, 
  stripeWebhook, 
  getPaymentSummary,
  verifyPayment,
  initiateTelebirrPayment, // Added Telebirr Initiation
  telebirrWebhook          // Added Telebirr Webhook
} = require("../controller/paymentController");

// --- PUBLIC ROUTES ---
// These are called by the payment servers (Stripe/Telebirr), not the user's browser.
router.post("/webhook", stripeWebhook);
router.post("/telebirr-webhook", telebirrWebhook);

// --- PROTECTED ROUTES ---
// Require a valid user token (protect middleware)

// Stripe: Create payment intent for the card element
router.post("/create-payment-intent", protect, createPaymentIntent);

// Stripe: Manually verify payment after frontend confirmation
router.put("/verify/:id", protect, verifyPayment);

// Telebirr: Generate the encrypted redirect URL for the user
router.post("/initiate-telebirr", protect, initiateTelebirrPayment);

// General: Get order payment status/summary
router.get("/:id/summary", protect, getPaymentSummary);

module.exports = router;
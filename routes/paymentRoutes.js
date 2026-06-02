const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const paymentController = require("../controller/paymentController");

// Verify that all functions exist during boot runtime to point out exact omissions
const handlers = [
  'stripeWebhook',
  'telebirrWebhook',
  'createPaymentIntent',
  'verifyPayment',
  'initiateTelebirrPayment',
  'getPaymentSummary'
];

handlers.forEach(handler => {
  if (typeof paymentController[handler] !== 'function') {
    throw new TypeError(`Payment route initialization failed: '${handler}' is not exported as a function in paymentController.js`);
  }
});

// --- PUBLIC ROUTES ---
router.post("/webhook", paymentController.stripeWebhook);
router.post("/telebirr-webhook", paymentController.telebirrWebhook);

// --- PROTECTED ROUTES ---
router.post("/create-payment-intent", protect, paymentController.createPaymentIntent);
router.put("/verify/:id", protect, paymentController.verifyPayment);
router.post("/initiate-telebirr", protect, paymentController.initiateTelebirrPayment);
router.get("/:id/summary", protect, paymentController.getPaymentSummary);

module.exports = router;
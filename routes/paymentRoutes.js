const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const paymentController = require('../controller/paymentController');

// ── Boot-time guard: throws immediately if any handler is missing ──────────
const requiredHandlers = [
  'stripeWebhook',
  'telebirrWebhook',
  'createPaymentIntent',
  'verifyPayment',
  'initiateTelebirrPayment',
  'initiateWalletDeposit', // 🆕 Added to safeguard wallet deposit initiation
  'payWithWallet',          // 🆕 Added to safeguard wallet balance checkout
  'getPaymentSummary'
];

requiredHandlers.forEach((handler) => {
  if (typeof paymentController[handler] !== 'function') {
    throw new TypeError(
      `Payment route init failed: '${handler}' is not exported from paymentController.js`
    );
  }
});

// ── PUBLIC (Telebirr / Stripe call these directly, no auth token) ──────────
router.post('/webhook',           paymentController.stripeWebhook);
router.post('/telebirr-webhook',  paymentController.telebirrWebhook);

// ── PROTECTED ──────────────────────────────────────────────────────────────
router.post('/create-payment-intent', protect, paymentController.createPaymentIntent);
router.put( '/verify/:id',            protect, paymentController.verifyPayment);
router.post('/initiate-telebirr',     protect, paymentController.initiateTelebirrPayment);
router.post('/initiate-wallet-deposit', protect, paymentController.initiateWalletDeposit); // 🆕 Standalone Top-up URL
router.post('/pay-with-wallet',       protect, paymentController.payWithWallet);          // 🆕 Internal Balance Checkout
router.get( '/:id/summary',           protect, paymentController.getPaymentSummary);

module.exports = router;
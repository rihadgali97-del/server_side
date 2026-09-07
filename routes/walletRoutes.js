const express    = require('express');
const router     = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const ctrl       = require('../controller/walletController');

// GET  /api/vendors/wallet          — get balance + transactions
// POST /api/vendors/wallet/withdraw — initiate withdrawal
router.get('/',         protect, authorizeRoles('vendor'), ctrl.getVendorWallet);
router.post('/withdraw',protect, authorizeRoles('vendor'), ctrl.withdrawFunds);

module.exports = router;
const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const ctrl = require('../controller/exportController');

// ── Admin export routes ────────────────────────────────────────────────────────
router.get('/admin/orders/csv', protect, authorizeRoles('admin'), ctrl.adminExportOrdersCSV);
router.get('/admin/orders/json', protect, authorizeRoles('admin'), ctrl.adminExportOrdersJSON);
router.get('/admin/revenue/csv', protect, authorizeRoles('admin'), ctrl.adminExportRevenueCSV);
router.get('/admin/vendors/csv', protect, authorizeRoles('admin'), ctrl.adminExportVendorRevenueCSV);

// ── Vendor export routes ───────────────────────────────────────────────────────
router.get('/vendor/orders/csv', protect, authorizeRoles('vendor'), ctrl.vendorExportOrdersCSV);
router.get('/vendor/revenue/json', protect, authorizeRoles('vendor'), ctrl.vendorExportRevenueJSON);

module.exports = router;
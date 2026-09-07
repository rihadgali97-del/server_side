const express = require("express");
const router  = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const ctrl = require("../controller/couponController");

// Public: validate a coupon at checkout
router.post("/validate", protect, ctrl.validateCoupon);

// Admin: full CRUD
router.get(   "/admin",     protect, authorizeRoles("admin"), ctrl.adminGetCoupons);
router.post(  "/admin",     protect, authorizeRoles("admin"), ctrl.adminCreateCoupon);
router.put(   "/admin/:id", protect, authorizeRoles("admin"), ctrl.adminUpdateCoupon);
router.delete("/admin/:id", protect, authorizeRoles("admin"), ctrl.adminDeleteCoupon);

// Vendor: manage own coupons
router.get(   "/vendor",     protect, authorizeRoles("vendor"), ctrl.vendorGetCoupons);
router.post(  "/vendor",     protect, authorizeRoles("vendor"), ctrl.vendorCreateCoupon);
router.put(   "/vendor/:id", protect, authorizeRoles("vendor"), ctrl.vendorUpdateCoupon);
router.delete("/vendor/:id", protect, authorizeRoles("vendor"), ctrl.vendorDeleteCoupon);

module.exports = router;
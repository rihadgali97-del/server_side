const express = require("express");
const router = express.Router();
const { getVendorAuditReport } = require("../controller/reportController");
// Change 'admin' to 'authorizeRoles' to match your existing middleware exports
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/vendor-audit", protect, authorizeRoles("admin"), getVendorAuditReport);

module.exports = router;
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Added User import
const Vendor = require("../models/Vendor");

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // FETCH USER FROM DB: This ensures we have the latest 'isVerified' status
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "User no longer exists" });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied: insufficient permissions" });
    }
    next();
  };
};

const isEmailVerified = (req, res, next) => {
  // Now req.user.isVerified will be accurate because we fetched it in 'protect'
  if (!req.user || !req.user.isVerified) {
    return res.status(403).json({
      message: "Access denied. Please verify your email address first.",
    });
  }
  next();
};

const isApprovedVendor = async (req, res, next) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ message: "Only vendors can perform this action." });
  }

  const vendorProfile = await Vendor.findOne({ user: req.user.id });

  if (!vendorProfile || !vendorProfile.isVerified) {
    return res.status(403).json({
      message: "Your vendor account is pending admin approval.",
    });
  }
  next();
};

// Use one clean export object
module.exports = { 
  protect, 
  authorizeRoles, 
  isEmailVerified, 
  isApprovedVendor 
};
const User = require('../models/User');
const Vendor = require('../models/Vendor');

// Middleware to check if user has required role(s)
const requireRole = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Fetch full user data if not already populated
            if (!req.user.role) {
                const user = await User.findById(req.user.id);
                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: 'User not found'
                    });
                }
                req.user = user;
            }

            // Check if user's role is in allowed roles
            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: insufficient permissions'
                });
            }

            next();
        } catch (error) {
            console.error('Role middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error in role check'
            });
        }
    };
};

// Middleware to check if user is vendor and optionally verified
const requireVendor = (requireVerified = false) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Check if user is vendor
            if (req.user.role !== 'vendor') {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: vendor role required'
                });
            }

            // Fetch vendor data
            const vendor = await Vendor.findOne({ user: req.user.id });
            if (!vendor) {
                return res.status(403).json({
                    success: false,
                    message: 'Vendor profile not found'
                });
            }

            if (requireVerified && !vendor.isVerified) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: vendor verification required'
                });
            }

            req.vendor = vendor;
            next();
        } catch (error) {
            console.error('Vendor middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error in vendor check'
            });
        }
    };
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceUserId) => {
    return (req, res, next) => {
        if (req.user.role === 'admin') {
            return next();
        }

        if (req.user.id !== resourceUserId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: not owner of resource'
            });
        }

        next();
    };
};

// Middleware for admin only
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied: admin role required'
        });
    }
    next();
};

module.exports = {
    requireRole,
    requireVendor,
    requireOwnershipOrAdmin,
    requireAdmin
};

const AuditLog = require('../models/AuditLog');

const getClientIp = (req) => {
    const rawIp = req.ip || req.socket?.remoteAddress;
    if (!rawIp) return 'Unavailable';
    if (rawIp === '::1') return '127.0.0.1';
    return rawIp.replace(/^::ffff:/, '');
};

const recordAuditLog = async (req, { action, target, resourceId, details, before, after, success = true }) => {
    return AuditLog.create({
        adminId: req.user._id,
        adminEmail: req.user.email,
        action,
        target,
        resourceId,
        details,
        before,
        after,
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || 'Unavailable',
        method: req.method,
        path: req.originalUrl,
        success,
    });
};

module.exports = { getClientIp, recordAuditLog };

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminEmail: { type: String },
  action: { type: String, required: true }, // e.g., "UPDATE_COMMISSION", "TOGGLE_MAINTENANCE"
  target: { type: String }, // e.g., "Finance Settings"
  resourceId: { type: String },
  details: { type: String },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  method: { type: String },
  path: { type: String },
  success: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now }
});

auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
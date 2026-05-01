const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balances: {
        type: Map,
        of: Number,
        default: () => new Map([['ETB', 0]])
    },
    pending: {
        type: Map,
        of: Number,
        default: () => new Map([['ETB', 0]])
    },
    primaryCurrency: {
        type: String,
        default: 'ETB'
    },
    supportedCurrencies: {
        type: [String],
        default: ['ETB', 'USD']
    },
    isActive: { type: Boolean, default: true },
    isFrozen: { type: Boolean, default: false }
}, { timestamps: true });

// --- PRO METHODS WITH SESSION SUPPORT ---

walletSchema.methods.addPending = async function(amount, currency, session) {
    if (!this.isActive || this.isFrozen) throw new Error('Wallet inactive/frozen');
    const curr = currency || this.primaryCurrency;
    const currentPending = this.pending.get(curr) || 0;
    this.pending.set(curr, currentPending + amount);
    return await this.save({ session });
};

walletSchema.methods.releasePending = async function(amount, currency, session) {
    const curr = currency || this.primaryCurrency;
    const currentPending = this.pending.get(curr) || 0;
    
    if (currentPending < amount) throw new Error('Insufficient pending amount');
    
    // Decrease Pending
    this.pending.set(curr, currentPending - amount);
    
    // Increase Actual Balance
    const currentBalance = this.balances.get(curr) || 0;
    this.balances.set(curr, currentBalance + amount);
    
    return await this.save({ session });
};

module.exports = mongoose.model('Wallet', walletSchema);
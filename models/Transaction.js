const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    wallet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit', 'pending', 'release', 'transfer', 'withdrawal', 'deposit', 'refund', 'fee'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'ETB'
    },
    description: {
        type: String,
        required: true
    },
    reference: {
        type: String, // Stores Order ID
    },
    referenceType: {
        type: String,
        enum: ['order', 'payment', 'transfer', 'withdrawal', 'deposit', 'refund', 'fee'],
        default: 'order'
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'completed'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed 
    }
}, { timestamps: true });

transactionSchema.index({ wallet: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    commissionRate: {
        type: Number,
        default: 5, // 5% commission
        min: 0,
        max: 100
    },
    defaultCurrency: {
        type: String,
        default: 'ETB',
        enum: ['USD', 'EUR', 'GBP', 'INR', 'ETB']
    },
    globalConfigurations: {
        allowNewVendors: {
            type: Boolean,
            default: true
        },
        maintenanceMode: {
            type: Boolean,
            default: false
        },
        maxOrderValue: {
            type: Number,
            default: 10000
        },
        minOrderValue: {
            type: Number,
            default: 1
        },
        taxRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        freeShippingThreshold: {
            type: Number,
            default: 0,
            min: 0
        }
    }
}, { timestamps: true });

// Ensure only one settings document exists
settingsSchema.pre('save', async function() {
    if (this.isNew) {
        const existing = await this.constructor.findOne();
        if (existing) {
            throw new Error('Only one settings document is allowed');
        }
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
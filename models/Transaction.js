const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        reference: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        phone: {
            type: String,
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 1,
        },
        provider: {
            type: String,
            required: true,
            enum: ['m-pesa', 'airtel', 'card', 'other'],
            default: 'm-pesa',
        },
        method: {
            type: String,
            enum: ['stk', 'card'],
            default: 'stk',
        },
        status: {
            type: String,
            enum: ['pending', 'success', 'failed', 'cancelled'],
            default: 'pending',
            index: true,
        },
        customerName: {
            type: String,
            default: '',
            trim: true,
        },
        description: {
            type: String,
            default: 'Eagle Master payment',
        },
        // PayHero response fields
        payheroReference: { type: String, default: '' },
        checkoutRequestId: { type: String, default: '' },
        merchantRequestId: { type: String, default: '' },
        resultCode: { type: Number, default: null },
        resultDescription: { type: String, default: '' },

        // Raw payloads for auditing
        initiatePayload: { type: Object, default: null },
        initiateResponse: { type: Object, default: null },
        callbackPayload: { type: Object, default: null },

        initiatedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Single-field index for admin transactions list sorted by date
transactionSchema.index({ createdAt: -1 });

// Compound index for /api/admin/stats aggregations that filter by status and sort by date
transactionSchema.index({ status: 1, createdAt: -1 });

// Compound index for filtering by status and phone (used by search filters)
transactionSchema.index({ status: 1, phone: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);

const mongoose = require("mongoose");

const schemePaymentAttemptSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        subscription: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "UserScheme",
            required: true,
            index: true
        },

        monthNo: {
            type: Number,
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        currency: {
            type: String,
            default: "INR"
        },

        razorpayOrderId: {
            type: String,
            required: true,
            unique: true
        },

        razorpayPaymentId: {
            type: String,
            default: null,
            sparse: true
        },

        status: {
            type: String,
            enum: [
                "CREATED",
                "PAID",
                "FAILED",
                "INSTALLMENT_PAID"
            ],
            default: "CREATED",
            index: true
        },

        payment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            default: null
        },

        failureReason: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate successful installments at the attempt level.
schemePaymentAttemptSchema.index(
    { subscription: 1, monthNo: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: "INSTALLMENT_PAID"
        }
    }
);

schemePaymentAttemptSchema.index(
    { razorpayPaymentId: 1 },
    {
        unique: true,
        sparse: true
    }
);

module.exports = mongoose.model(
    "SchemePaymentAttempt",
    schemePaymentAttemptSchema
);
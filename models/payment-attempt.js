const mongoose = require("mongoose");

const paymentAttemptSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        variantId: {
            type: String,
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        address: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Address",
            required: true
        },

        amount: {
            type: Number,
            required: true
        },

        currency: {
            type: String,
            default: "INR"
        },

        razorpayOrderId: {
            type: String,
            unique: true,
            sparse: true
        },

        razorpayPaymentId: String,

        status: {
            type: String,
            enum: ["CREATED", "PAID", "FAILED", "ORDER_CREATED"],
            default: "CREATED"
        },

        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model(
    "PaymentAttempt",
    paymentAttemptSchema
);

const mongoose = require("mongoose");

const paymentAttemptItemSchema = new mongoose.Schema(
    {
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
        }
    },
    { _id: false }
);

const paymentAttemptSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        // Existing Buy Now fields — backward compatibility
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: false
        },

        variantId: {
            type: String,
            required: false
        },

        quantity: {
            type: Number,
            required: false,
            min: 1
        },

        // Cart checkout: multiple products and variants
        items: {
            type: [paymentAttemptItemSchema],
            default: undefined,
            validate: {
                validator: function (items) {
                    // Allow old Buy Now attempts without items.
                    if (!items || items.length === 0) {
                        return true;
                    }

                    return items.every(
                        item =>
                            item.product &&
                            item.variantId &&
                            Number.isInteger(item.quantity) &&
                            item.quantity >= 1
                    );
                },
                message: "Each payment item must have a product, variant and valid quantity."
            }
        },

        // BUY_NOW or CART
        checkoutMode: {
            type: String,
            enum: ["BUY_NOW", "CART"],
            default: "BUY_NOW"
        },

        address: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Address",
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
            unique: true,
            sparse: true
        },

        razorpayPaymentId: {
            type: String
        },

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

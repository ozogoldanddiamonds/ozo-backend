const mongoose = require("mongoose");

const supplierPurchaseItemSchema = new mongoose.Schema(
    {

        // Supplier Purchase / Invoice
        purchase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SupplierPurchase",
            required: true
        },

        // Main Product
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        // Exact Variant inside Product.variants[]
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        // Quantity received in this purchase
        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        // Quantity currently available from this purchase
        availableQuantity: {
            type: Number,
            default: 0,
            min: 0
        },

        // Supplier's product/reference code
        supplierProductCode: {
            type: String,
            default: "",
            trim: true
        },

        // Supplier batch / lot number
        batchNumber: {
            type: String,
            default: "",
            trim: true
        },

        // Purchase price per unit
        purchasePrice: {
            type: Number,
            required: true,
            min: 0
        },

        // Discount amount for this item
        discount: {
            type: Number,
            default: 0,
            min: 0
        },

        // Tax percentage for this item
        tax: {
            type: Number,
            default: 0,
            min: 0
        },

        // Final total for this item
        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        notes: {
            type: String,
            default: "",
            trim: true
        }

    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.SupplierPurchaseItem ||
    mongoose.model(
        "SupplierPurchaseItem",
        supplierPurchaseItemSchema
    );
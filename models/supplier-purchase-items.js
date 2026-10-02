const mongoose = require("mongoose");

const supplierPurchaseItemSchema = new mongoose.Schema({

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

    // Exact Product Variant
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    availableQuantity: {
        type: Number,
        default: 0,
        min: 0
    },

    purchasePrice: {
        type: Number,
        required: true
    },
    supplierProductCode: {
        type: String,
        default: "",
        trim: true
    },

    batchNumber: {
        type: String,
        default: "",
        trim: true
    },

    discount: {
        type: Number,
        default: 0
    },

    tax: {
        type: Number,
        default: 0
    },

    totalAmount: {
        type: Number,
        required: true
    },

    notes: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.SupplierPurchaseItem ||
    mongoose.model(
        "SupplierPurchaseItem",
        supplierPurchaseItemSchema
    );
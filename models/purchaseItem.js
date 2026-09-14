const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema({

    purchase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SupplierPurchase",
        required: true
    },

    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    },

    purchasePrice: {
        type: Number,
        required: true
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
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.PurchaseItem ||
    mongoose.model("PurchaseItem", purchaseItemSchema);
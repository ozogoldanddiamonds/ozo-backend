const mongoose = require("mongoose");

const makerProductionItemSchema = new mongoose.Schema({

    production: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MakerProduction",
        required: true
    },

    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    quantityGiven: {
        type: Number,
        required: true,
        min: 1
    },

    quantityReceived: {
        type: Number,
        default: 0,
        min: 0
    },
    availableQuantity: {
        type: Number,
        default: 0,
        min: 0
    },

    notes: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.MakerProductionItem ||
    mongoose.model(
        "MakerProductionItem",
        makerProductionItemSchema
    );
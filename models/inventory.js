const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({

    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        unique: true
    },

    quantity: {
        type: Number,
        default: 0
    },

    availableQuantity: {
        type: Number,
        default: 0
    },

    reservedQuantity: {
        type: Number,
        default: 0
    },

    soldQuantity: {
        type: Number,
        default: 0
    },

    lastPurchaseDate: {
        type: Date
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.Inventory ||
    mongoose.model("Inventory", inventorySchema);
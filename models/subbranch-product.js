const mongoose = require("mongoose");

const subBranchProductSchema = new mongoose.Schema({

    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true
    },

    subBranchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true
    },

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    assignedQuantity: {
        type: Number,
        required: true
    },

    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin"
    }

}, {
    timestamps: true
});

module.exports = mongoose.model(
    "SubBranchProduct",
    subBranchProductSchema
);
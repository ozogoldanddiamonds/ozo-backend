const mongoose = require("mongoose");

const makerProductionSchema = new mongoose.Schema({

    maker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Maker",
        required: true
    },

    productionNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    issueDate: {
        type: Date,
        default: Date.now
    },

    expectedDate: {
        type: Date,
        default: null
    },

    receivedDate: {
        type: Date,
        default: null
    },

    status: {
        type: String,
        enum: [
            "DRAFT",
            "ISSUED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED"
        ],
        default: "DRAFT"
    },

    notes: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.MakerProduction ||
    mongoose.model("MakerProduction", makerProductionSchema);
const mongoose = require("mongoose");

const metalRateSchema = new mongoose.Schema({

    metalType: {
        type: String,
        enum: ["gold", "silver", "platinum"],
        required: true
    },

    purity: {
        type: String,
        required: true
    },

    unit: {
        type: String,
        default: "gram"
    },

    ratePerGram: {
        type: Number,
        required: true
    },

    effectiveDate: {
        type: Date,
        default: Date.now
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

module.exports =
    mongoose.models.MetalRate ||
    mongoose.model("MetalRate", metalRateSchema);
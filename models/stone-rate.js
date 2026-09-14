const mongoose = require("mongoose");
const stoneRateSchema = new mongoose.Schema({

    stoneType: {
        type: String,
        enum: [
            "diamond",
            "ruby",
            "emerald",
            "sapphire",
            "pearl",
            "opal",
            "topaz",
            "coral",
            "other"
        ],
        required: true
    },

    stoneCategory: {
        type: String,
        enum: [
            "natural",
            "lab-grown",
            "premium",
            "standard"
        ]
    },

    quality: String,

    unit: {
        type: String,
        default: "carat"
    },

    ratePerUnit: {
        type: Number,
        required: true
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

module.exports =
    mongoose.models.StoneRate ||
    mongoose.model("StoneRate", stoneRateSchema);
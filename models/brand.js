const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        unique: true
    },

    description: {
        type: String,
        default: "",
        trim: true
    },

    logo: {
        type: String,
        default: ""
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

module.exports =
    mongoose.models.Brand ||
    mongoose.model("Brand", brandSchema);
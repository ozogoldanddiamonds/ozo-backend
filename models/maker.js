const mongoose = require("mongoose");

const makerSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    phone: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        default: "",
        trim: true
    },

    address: {
        addressLine1: {
            type: String,
            default: ""
        },

        addressLine2: {
            type: String,
            default: ""
        },

        city: {
            type: String,
            default: ""
        },

        state: {
            type: String,
            default: ""
        },

        pincode: {
            type: String,
            default: ""
        },

        country: {
            type: String,
            default: "India"
        }
    },

    specialization: {
        type: String,
        default: "",
        trim: true
    },

    notes: {
        type: String,
        default: ""
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.Maker ||
    mongoose.model("Maker", makerSchema);
const mongoose = require("mongoose");



const supplierSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    companyName: {
        type: String,
        default: ""
    },

    phone: {
        type: String,
        required: true
    },

    email: {
        type: String,
        default: ""
    },

    gstNumber: {
        type: String,
        default: ""
    },

    address: {
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        pincode: String,
        country: {
            type: String,
            default: "India"
        }
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
    mongoose.models.Supplier ||
    mongoose.model("Supplier", supplierSchema);
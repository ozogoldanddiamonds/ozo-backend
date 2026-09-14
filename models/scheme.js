const mongoose = require("mongoose");

const schemeSchema = new mongoose.Schema({

    // =========================
    // SCHEME NAME
    // =========================

    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },

    // =========================
    // TOTAL SCHEME AMOUNT
    // =========================

    amount: {
        type: Number,
        required: true,
        min: 1
    },

    // =========================
    // TOTAL DURATION
    // =========================

    durationMonths: {
        type: Number,
        default: 12,
        min: 1
    },

    // =========================
    // CUSTOMER PAY MONTHS
    // =========================

    userPayMonths: {
        type: Number,
        default: 11,
        min: 1
    },

    // =========================
    // COMPANY PAY MONTHS
    // =========================

    companyPayMonths: {
        type: Number,
        default: 1,
        min: 0
    },

    // =========================
    // MONTHLY INSTALLMENT
    // Auto Calculated
    // =========================

    monthlyAmount: {
        type: Number,
        required: true
    },

    // =========================
    // DESCRIPTION
    // =========================

    description: {
        type: String,
        required: true,
        trim: true
    },

    // =========================
    // BENEFITS
    // =========================

    benefits: [{
        type: String,
        trim: true
    }],

    // =========================
    // TERMS & CONDITIONS
    // =========================

    terms: {
        type: String,
        trim: true,
        default: ""
    },

    // =========================
    // POPULAR SCHEME
    // =========================

    isPopular: {
        type: Boolean,
        default: false
    },

    // =========================
    // DISPLAY ORDER
    // =========================

    displayOrder: {
        type: Number,
        default: 0
    },

    // =========================
    // ACTIVE / INACTIVE
    // =========================

    isActive: {
        type: Boolean,
        default: true
    }

},
    {
        timestamps: true
    });

module.exports =
    mongoose.model(
        "Scheme",
        schemeSchema
    );
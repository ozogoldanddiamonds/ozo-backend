const mongoose = require("mongoose");

const supplierPurchaseSchema = new mongoose.Schema({

    // Existing Supplier
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
        required: true
    },

    invoiceNumber: {
        type: String,
        required: true,
        trim: true
    },

    invoiceDate: {
        type: Date,
        required: true
    },

    purchaseDate: {
        type: Date,
        default: Date.now
    },

    subtotal: {
        type: Number,
        default: 0
    },

    discount: {
        type: Number,
        default: 0
    },

    tax: {
        type: Number,
        default: 0
    },

    totalAmount: {
        type: Number,
        required: true
    },

    paymentStatus: {
        type: String,
        enum: [
            "PENDING",
            "PARTIAL",
            "PAID"
        ],
        default: "PENDING"
    },

    notes: {
        type: String,
        default: ""
    },

    // Invoice / Bill / Challan / Other Documents
    documents: [
        {
            url: {
                type: String,
                required: true
            },

            type: {
                type: String,
                enum: [
                    "INVOICE",
                    "BILL",
                    "DELIVERY_CHALLAN",
                    "GST",
                    "OTHER"
                ],
                default: "OTHER"
            },

            description: {
                type: String,
                default: ""
            },

            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],

    status: {
        type: String,
        enum: [
            "DRAFT",
            "RECEIVED",
            "CANCELLED"
        ],
        default: "DRAFT"
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.SupplierPurchase ||
    mongoose.model("SupplierPurchase", supplierPurchaseSchema);
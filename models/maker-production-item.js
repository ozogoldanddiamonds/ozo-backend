const mongoose = require("mongoose");

const makerProductionItemSchema = new mongoose.Schema(
    {

        // =====================================================
        // MAKER PRODUCTION / JOB
        // =====================================================

        production: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MakerProduction",
            required: true
        },


        // =====================================================
        // MAIN PRODUCT
        // =====================================================

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },


        // =====================================================
        // EXACT PRODUCT VARIANT
        // =====================================================
        //
        // Product.variants[] lo unna exact variant _id
        //
        // =====================================================

        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },


        // =====================================================
        // QUANTITY GIVEN TO MAKER
        // =====================================================

        quantityGiven: {
            type: Number,
            required: true,
            min: 1
        },


        // =====================================================
        // QUANTITY RECEIVED FROM MAKER
        // =====================================================

        quantityReceived: {
            type: Number,
            default: 0,
            min: 0
        },


        // =====================================================
        // AVAILABLE QUANTITY
        // =====================================================
        //
        // Quantity currently available for further use/sale.
        //
        // Example:
        //
        // quantityReceived = 10
        // availableQuantity = 10
        //
        // After using/selling 2:
        //
        // availableQuantity = 8
        //
        // =====================================================

        availableQuantity: {
            type: Number,
            default: 0,
            min: 0
        },


        // =====================================================
        // PRODUCTION BATCH NUMBER
        // =====================================================
        //
        // Same Product + Variant can be produced in
        // different batches.
        //
        // =====================================================

        batchNumber: {
            type: String,
            default: "",
            trim: true
        },


        // =====================================================
        // NOTES
        // =====================================================

        notes: {
            type: String,
            default: "",
            trim: true
        }

    },
    {
        timestamps: true
    }
);


module.exports =
    mongoose.models.MakerProductionItem ||
    mongoose.model(
        "MakerProductionItem",
        makerProductionItemSchema
    );
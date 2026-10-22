
const mongoose = require("mongoose");

const metaKeyWordsSEOSchema = new mongoose.Schema(
    {
        pageKey: {
            type: String,
            default: "home",
            unique: true,
            required: true,
            immutable: true
        },

        metaTitle: {
            type: String,
            trim: true,
            maxlength: 70,
            default: ""
        },

        metaDescription: {
            type: String,
            trim: true,
            maxlength: 320,
            default: ""
        },

        metaKeywords: {
            type: [String],
            default: []
        },

        canonicalUrl: {
            type: String,
            trim: true,
            default: ""
        },

        ogTitle: {
            type: String,
            trim: true,
            default: ""
        },

        ogDescription: {
            type: String,
            trim: true,
            default: ""
        },

        ogImage: {
            type: String,
            trim: true,
            default: ""
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "MetaKeyWords",
    metaKeyWordsSEOSchema
);

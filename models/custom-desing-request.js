const mongoose = require("mongoose");

const customDesignRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // =========================
    // CATEGORY
    // =========================

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true
    },

    subSubCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubSubCategory",
      required: true
    },

    // =========================
    // DESIGN
    // =========================

    referenceImages: [
      {
        url: {
          type: String,
          required: true
        },

        publicId: {
          type: String,
          default: null
        }
      }
    ],

    description: {
      type: String,
      required: true,
      trim: true
    },

    // =========================
    // REQUIREMENTS
    // =========================

    metalType: {
      type: String,
      enum: ["gold", "silver", "platinum"],
      default: null
    },

    metalPurity: {
      type: String,
      default: null,
      trim: true
    },

    metalColor: {
      type: String,
      enum: ["yellow", "white", "rose"],
      default: null
    },

    stonePreference: {
      type: String,
      default: null,
      trim: true
    },

    budget: {
      type: Number,
      min: 0,
      default: null
    },

    requiredDate: {
      type: Date,
      default: null
    },

    // =========================
    // STATUS
    // =========================

    status: {
      type: String,
      enum: [
        "NEW",
        "CONTACTED",
        "DISCUSSION",
        "QUOTATION_SENT",
        "ACCEPTED",
        "ORDER_CREATED",
        "IN_PRODUCTION",
        "COMPLETED",
        "REJECTED",
        "CANCELLED"
      ],
      default: "NEW"
    },

    adminNotes: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "CustomDesignRequest",
  customDesignRequestSchema
);
const mongoose = require("mongoose");

const customDesignRequestSchema = new mongoose.Schema(
  {
    // Unique Request Number
    requestNumber: {
      type: String,
      unique: true,
      trim: true
    },

    // Logged-in Customer
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Jewellery Type
    jewelleryType: {
      type: String,
      required: true,
      enum: [
        "RING",
        "NECKLACE",
        "EARRINGS",
        "BANGLES",
        "BRACELET",
        "CHAIN",
        "PENDANT",
        "OTHER"
      ]
    },

    // Design Type
    designType: {
      type: String,
      required: true,
      enum: ["REFERENCE_DESIGN", "NEW_DESIGN"]
    },

    // Multiple Reference Images
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

    // Design Description
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    // Metal Type
    metalType: {
      type: String,
      required: true,
      enum: [
        "GOLD",
        "GOLD_DIAMOND",
        "SILVER",
        "PLATINUM"
      ]
    },

    goldPurity: {
      type: String,
      enum: ["18K", "22K", "24K"],
      default: null
    },

    goldColor: {
      type: String,
      enum: ["YELLOW", "WHITE", "ROSE"],
      default: null
    },

    // Approximate Weight in Grams
    goldWeight: {
      type: Number,
      required: true,
      min: [0.1, "Weight must be greater than zero"]
    },

    // Stone Details
    stoneType: {
      type: String,
      required: true,
      enum: ["NONE", "DIAMOND", "GEMSTONE"]
    },

    diamondType: {
      type: String,
      enum: ["NATURAL", "LAB_GROWN"],
      default: null
    },

    // Used when stoneType is GEMSTONE
    gemstoneType: {
      type: String,
      trim: true,
      default: null
    },

    // Delivery Date
    requiredDate: {
      type: Date,
      default: null
    },

    // Quantity
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },

    // Preferred Contact Method
    preferredContactMethod: {
      type: String,
      enum: ["WHATSAPP", "PHONE", "EMAIL"],
      default: "WHATSAPP"
    },

    // Additional Notes
    additionalNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    // Admin Management
    status: {
      type: String,
      enum: [
        "PENDING",
        "UNDER_REVIEW",
        "QUOTATION_SENT",
        "APPROVED",
        "IN_PRODUCTION",
        "COMPLETED",
        "REJECTED",
        "CANCELLED"
      ],
      default: "PENDING"
    },

    adminNotes: {
      type: String,
      default: ""
    },

    quotedPrice: {
      type: Number,
      min: 0,
      default: null
    },

    estimatedDeliveryDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Conditional validations
customDesignRequestSchema.pre("validate", function () {
  if (
    ["GOLD", "GOLD_DIAMOND"].includes(this.metalType) &&
    !this.goldPurity
  ) {
    this.invalidate(
      "goldPurity",
      "Gold purity is required"
    );
  }

  if (
    this.stoneType === "DIAMOND" &&
    !this.diamondType
  ) {
    this.invalidate(
      "diamondType",
      "Please select diamond type"
    );
  }

  if (
    this.stoneType === "GEMSTONE" &&
    !this.gemstoneType
  ) {
    this.invalidate(
      "gemstoneType",
      "Please specify gemstone type"
    );
  }

  if (
    this.designType === "REFERENCE_DESIGN" &&
    (!this.referenceImages ||
      this.referenceImages.length === 0)
  ) {
    this.invalidate(
      "referenceImages",
      "Please upload at least one reference image"
    );
  }
});

module.exports = mongoose.model(
  "CustomDesignRequest",
  customDesignRequestSchema
);
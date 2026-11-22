const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    size: { type: String },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
    },

    stock: {
      type: Number,
      default: 0,
      required: [true, "Stock is required"],
    },

    // =========================
    // METAL DETAILS
    // =========================

    metalType: {
      type: String,
      enum: ["gold", "silver", "platinum"],
    },

    metalPurity: {
      type: String,
      required: [true, "Metal purity is required"],
    },

    metalColor: {
      type: String,
      enum: ["yellow", "white", "rose"],
    },

    grossWeight: {
      type: Number,
      required: [true, "Gross weight is required"],
    },

    netWeight: {
      type: Number,
      required: [true, "Net weight is required"],
    },

    wastagePercentage: {
      type: Number,
      default: 0,
    },

    // =========================
    // STONES
    // =========================

    stones: [
      {
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
            "other",
          ],
        },

        stoneCategory: {
          type: String,
          enum: ["natural", "lab-grown", "premium", "standard"],
        },

        quality: {
          type: String,
          default: null,
        },

        totalWeight: {
          type: Number,
          default: 0,
        },

        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],

    // =========================
    // CHARGES
    // =========================

    makingCharges: {
      type: Number,
      default: 0,
    },

    makingChargeType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },

    discountPercentage: {
      type: Number,
      default: 0,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      trim: true,
    },

    shortDescription: String,

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "  Category name is required"],
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: [true, "subCategory name is required"],
    },

    subSubCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubSubCategory",
      required: [true, "subsub Category name is required"],
    },

    productType: {
      type: String,
      enum: [
        "gold",
        "silver",
        "platinum",
        "diamond",
        "gemstone",
        "gold_diamond",
        "silver_diamond",
        "platinum_diamond",
        "gold_gemstone",
        "silver_gemstone",
        "platinum_gemstone",
      ],
      required: [true, "Product type name is required"],
    },

    gender: {
      type: String,
      enum: ["men", "women", "unisex"],
    },

    occasion: {
      type: String,
    },

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },

    hallmarkCertified: {
      type: Boolean,
      default: true,
    },

    hallmarkNumber: {
      type: String,
      unique: true,
    },

    certificationIncluded: {
      type: Boolean,
      default: true,
    },
    description: String,
    certificateUrl: {
      type: String,
    },

    featured: {
      type: Boolean,
      default: false,
    },

    bestSeller: {
      type: Boolean,
      default: false,
    },

    trending: {
      type: Boolean,
      default: false,
    },

    newArrival: {
      type: Boolean,
      default: false,
    },

    variants: [variantSchema],

    images: [
      {
        type: String,
        required: [true, "image name is required"],
      },
    ],

    video: {
      type: String,
    },

    tags: [
      {
        type: String,
      },
    ],

    seoTitle: {
      type: String,
    },

    seoDescription: {
      type: String,
    },

    metaKeywords: [
      {
        type: String,
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);
module.exports =
  mongoose.models.Product || mongoose.model("Product", productSchema);

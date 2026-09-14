const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  size: {type: String},
  sku: {
    type: String,
    required: [true, "SKU is required"],
    unique: true
  },

  stock: {
    type: Number,
    default: 0,
    required: [true, "Stock is required"]
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
    required: [true, "Metal purity is required"]
  },

  metalColor: {
    type: String,
    enum: ["yellow", "white", "rose"]
  },

  grossWeight: {
    type: Number,
    required: [true, "Gross weight is required"]
  },

  netWeight: {
    type: Number,
    required: [true, "Net weight is required"]
  },

  wastagePercentage: {
    type: Number,
    default: 0
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
          "other"
        ]
      },

      stoneCategory: {
        type: String,
        enum: [
          "natural",
          "lab-grown",
          "premium",
          "standard"
        ]
      },

      quality: {
        type: String,
        default: null
      },

      totalWeight: {
        type: Number,
        default: 0
      },

      quantity: {
        type: Number,
        default: 1
      }
    }
  ],

  // =========================
  // CHARGES
  // =========================

  makingCharges: {
    type: Number,
    default: 0
  },

  makingChargeType: {
    type: String,
    enum: ["fixed", "percentage"],
    default: "fixed"
  },

  discountPercentage: {
    type: Number,
    default: 0
  },

  isDefault: {
    type: Boolean,
    default: false
  }

}, { _id: true });
const productSchema = new mongoose.Schema({

  name: {
    type: String,
     required: [true, "Product name is required"],
    trim: true
  },

  slug: {
    type: String,
    unique: true,
    trim: true
  },

  shortDescription: String,


  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
     required: [true, "  Category name is required"]
  },

  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory",
     required: [true, "subCategory name is required"]
  },

  subSubCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubSubCategory",
     required: [true, "subsub Category name is required"]
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
      "platinum_gemstone"
    ],
    required: [true, "Product type name is required"]
  },

  gender: {
    type: String,
    enum: [
      "men",
      "women",
      "unisex"
    ]
  },

  occasion: {
    type: String
  },

  brand: {
    type: String
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
    default: true
  },
  description: String,
  certificateUrl: {
    type: String
  },


  featured: {
    type: Boolean,
    default: false
  },

  bestSeller: {
    type: Boolean,
    default: false
  },

  trending: {
    type: Boolean,
    default: false
  },

  newArrival: {
    type: Boolean,
    default: false
  },

  variants: [variantSchema],

  images: [{
    type: String,
        required: [true, "image name is required"]

  }],

  video: {
    type: String
  },

  tags: [{
    type: String
  }],

  seoTitle: {
    type: String
  },

  seoDescription: {
    type: String
  },

  metaKeywords: [{
    type: String
  }],

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});
module.exports = mongoose.models.Product || mongoose.model(
  "Product",
  productSchema
);


// // =========================
// // Diamond Details Schema
// // =========================

// const diamondSchema =
//   new mongoose.Schema({

//     diamondType: {
//       type: String,
//       enum: [
//         "NATURAL",
//         "LAB_GROWN"
//       ],
//       default: "NATURAL"
//     },

//     shape: {
//       type: String,
//       enum: [
//         "ROUND",
//         "OVAL",
//         "PRINCESS",
//         "CUSHION",
//         "EMERALD",
//         "PEAR",
//         "HEART",
//         "MARQUISE"
//       ]
//     },

//     carat: {
//       type: Number
//     },

//     color: {
//       type: String
//     },

//     clarity: {
//       type: String
//     },

//     cut: {
//       type: String
//     },

//     polish: {
//       type: String
//     },

//     symmetry: {
//       type: String
//     },

//     fluorescence: {
//       type: String
//     },

//     certificateLab: {
//       type: String,
//       enum: [
//         "GIA",
//         "IGI",
//         "HRD",
//         "AGS",
//         "NONE"
//       ],
//       default: "NONE"
//     },

//     certificateNumber: {
//       type: String
//     },

//     certificateUrl: {
//       type: String
//     },

//     // SINGLE DIAMOND PRICE

//     diamondPrice: {
//       type: Number,
//       default: 0
//     },

//     // HOW MANY DIAMONDS

//     totalDiamonds: {
//       type: Number,
//       default: 1
//     }

//   }, {
//     _id: false
//   });




// // =========================
// // Variant Schema
// // =========================

// const variantSchema =
//   new mongoose.Schema({

//     size: {
//       type: String
//     },

//     stock: {
//       type: Number,
//       default: 0
//     },

//     // =========================
//     // GOLD DETAILS
//     // =========================

//     goldPurity: {
//       type: String,
//       enum: [
//         "14K",
//         "18K",
//         "22K",
//         "24K"
//       ]
//     },

//     goldColor: {
//       type: String,
//       enum: [
//         "YELLOW",
//         "WHITE",
//         "ROSE"
//       ]
//     },

//     grossWeight: {
//       type: Number
//     },

//     netWeight: {
//       type: Number
//     },

//     wastagePercentage: {
//       type: Number,
//       default: 0
//     },

//     // =========================
//     // MAKING CHARGES
//     // =========================

//     makingCharges: {
//       type: Number,
//       default: 0
//     },

//     // =========================
//     // DIAMONDS
//     // =========================

//     hasDiamond: {
//       type: Boolean,
//       default: false
//     },

//     diamonds: [diamondSchema],

//     // =========================
//     // OFFER / DISCOUNT
//     // =========================

//     discountPercentage: {
//       type: Number,
//       default: 0
//     }

//   });




// // =========================
// // Product Schema
// // =========================

// const productSchema =
//   new mongoose.Schema({

//     name: {
//       type: String,
//       required: true
//     },

//     slug: {
//       type: String,
//       unique: true
//     },

//     shortDescription: {
//       type: String
//     },

//     description: {
//       type: String
//     },

//     category: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Category"
//     },

//     subCategory: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "SubCategory"
//     },

//     subSubCategory: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "SubSubCategory"
//     },

//     productType: {
//       type: String,
//       enum: [
//         "GOLD",
//         "DIAMOND",
//         "GOLD_DIAMOND"
//       ],
//       required: true
//     },

//     gender: {
//       type: String,
//       enum: [
//         "MEN",
//         "WOMEN",
//         "UNISEX"
//       ]
//     },

//     occasion: {
//       type: String
//     },

//     brand: {
//       type: String
//     },

//     sku: {
//       type: String,
//       unique: true
//     },

//     hallmarkCertified: {
//       type: Boolean,
//       default: true
//     },

//     certificationIncluded: {
//       type: Boolean,
//       default: true
//     },

//     featured: {
//       type: Boolean,
//       default: false
//     },

//     bestSeller: {
//       type: Boolean,
//       default: false
//     },

//     trending: {
//       type: Boolean,
//       default: false
//     },

//     // =========================
//     // VARIANTS
//     // =========================

//     variants: [variantSchema],

//     // =========================
//     // MEDIA
//     // =========================

//     images: [
//       {
//         type: String
//       }
//     ],

//     video: {
//       type: String
//     },

//     // =========================
//     // TAGS
//     // =========================

//     tags: [
//       {
//         type: String
//       }
//     ],

//     // =========================
//     // SEO
//     // =========================

//     seoTitle: {
//       type: String
//     },

//     seoDescription: {
//       type: String
//     },

//     // =========================
//     // STATUS
//     // =========================

//     isActive: {
//       type: Boolean,
//       default: true
//     }

//   }, {
//     timestamps: true
//   });



// module.exports =

//   mongoose.models.Product ||

//   mongoose.model(
//     "Product",
//     productSchema
//   );
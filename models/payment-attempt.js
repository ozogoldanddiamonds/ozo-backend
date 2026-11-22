const mongoose = require("mongoose");

// ======================================
// PAYMENT ATTEMPT ITEM SCHEMA
// ======================================

const paymentAttemptItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: String,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // Supplier / Maker stock allocation
    stockAllocations: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    productSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    variantSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    pricingSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    stockReservationStatus: {
      type: String,
      enum: ["NOT_RESERVED", "RESERVED", "COMMITTED", "RELEASED"],
      default: "NOT_RESERVED",
    },

    stockReservedAt: {
      type: Date,
      default: null,
    },

    stockReservationExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

// ======================================
// CUSTOMER DETAILS
// ======================================

const customerDetailsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

// ======================================
// PAYMENT ATTEMPT SCHEMA
// ======================================

const paymentAttemptSchema = new mongoose.Schema(
  {
    // ONLINE / BRANCH / SUB_BRANCH
    orderSource: {
      type: String,
      enum: ["ONLINE", "BRANCH", "SUB_BRANCH"],
      default: "ONLINE",
      index: true,
    },

    // Ecommerce customer
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.orderSource === "ONLINE";
      },
      index: true,
    },

    // Existing Buy Now fields
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },

    variantId: {
      type: String,
      required: false,
    },

    quantity: {
      type: Number,
      required: false,
      min: 1,
    },

    // Cart / POS items
    items: {
      type: [paymentAttemptItemSchema],
      default: undefined,

      validate: {
        validator: function (items) {
          if (!items || items.length === 0) {
            return true;
          }

          return items.every(
            (item) =>
              item.product &&
              item.variantId &&
              Number.isInteger(item.quantity) &&
              item.quantity >= 1,
          );
        },

        message:
          "Each payment item must have a product, variant and valid quantity.",
      },
    },

    // BUY_NOW / CART / POS
    checkoutMode: {
      type: String,
      enum: ["BUY_NOW", "CART", "POS"],
      default: "BUY_NOW",
    },

    // Ecommerce delivery address
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: function () {
        return this.orderSource === "ONLINE";
      },
    },

    // POS customer details
    customerDetails: {
      type: customerDetailsSchema,
      default: undefined,
    },

    // Branch information
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    subBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // Staff who created the POS payment
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // POS payment method
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "UPI"],
      default: "ONLINE",
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    razorpayOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },

    razorpayPaymentId: {
      type: String,
    },

    status: {
      type: String,
      enum: ["CREATED", "PAID", "FAILED", "ORDER_CREATED"],
      default: "CREATED",
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
  },
  { timestamps: true },
);

// ======================================
// INDEXES
// ======================================

paymentAttemptSchema.index({
  orderSource: 1,
  branch: 1,
  createdAt: -1,
});

paymentAttemptSchema.index({
  orderSource: 1,
  subBranch: 1,
  createdAt: -1,
});

// ======================================
// MODEL
// ======================================

module.exports = mongoose.model("PaymentAttempt", paymentAttemptSchema);

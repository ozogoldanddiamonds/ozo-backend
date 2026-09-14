const mongoose = require("mongoose");

const userSchemeSchema = new mongoose.Schema({

  // ==========================
  // USER
  // ==========================

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  // ==========================
  // SCHEME
  // ==========================

  scheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scheme",
    required: true,
    index: true
  },

  // ==========================
  // SCHEME DETAILS
  // Snapshot of scheme at subscription time
  // ==========================

  schemeName: {
    type: String,
    required: true
  },

  schemeAmount: {
    type: Number,
    required: true
  },

  monthlyAmount: {
    type: Number,
    required: true
  },

  durationMonths: {
    type: Number,
    required: true
  },

  userPayMonths: {
    type: Number,
    required: true
  },

  companyPayMonths: {
    type: Number,
    required: true
  },

  // ==========================
  // DATES
  // ==========================

  startDate: {
    type: Date,
    required: true
  },

  nextDueDate: {
    type: Date,
    required: true
  },

  maturityDate: {
    type: Date,
    required: true
  },

  // ==========================
  // INSTALLMENTS
  // ==========================

  totalInstallments: {
    type: Number,
    required: true
  },

  paidInstallments: {
    type: Number,
    default: 0
  },

  remainingInstallments: {
    type: Number,
    required: true
  },

  // ==========================
  // PAYMENT
  // ==========================

  totalPaidAmount: {
    type: Number,
    default: 0
  },

  companyContribution: {
    type: Number,
    default: 0
  },

  // ==========================
  // STATUS
  // ==========================

  status: {

    type: String,

    enum: [

      "ACTIVE",

      "COMPLETED",

      "MATURED",

      "CANCELLED",

      "DEFAULTED"

    ],

    default: "ACTIVE"

  },

  // ==========================
  // REMARKS
  // ==========================

  remarks: {

    type: String,

    default: ""

  }

},
  {
    timestamps: true
  });

module.exports =
  mongoose.model(
    "UserScheme",
    userSchemeSchema
  );
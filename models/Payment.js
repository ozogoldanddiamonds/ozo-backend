const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({

  // ==========================
  // USER SUBSCRIPTION
  // ==========================

  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserScheme",
    required: true,
    index: true
  },

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
  // INSTALLMENT
  // ==========================

  monthNo: {
    type: Number,
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  dueDate: {
    type: Date,
    required: true
  },

  paymentDate: {
    type: Date,
    default: Date.now
  },

  // ==========================
  // PAYMENT MODE
  // ==========================

  paymentMode: {
    type: String,
    enum: [
      "CASH",
      "UPI",
      "CARD",
      "NETBANKING",
      "ONLINE"
    ],
    required: true
  },

  // ==========================
  // PAYMENT GATEWAY
  // ==========================

  gateway: {
    type: String,
    enum: [
      "PHONEPE",
      "RAZORPAY",
      "MANUAL"
    ],
    default: "MANUAL"
  },

  transactionId: {
    type: String,
    default: null
  },

  gatewayOrderId: {
    type: String,
    default: null
  },

  gatewayPaymentId: {
    type: String,
    default: null
  },

  // ==========================
  // STATUS
  // ==========================

  status: {
    type: String,
    enum: [
      "PENDING",
      "PAID",
      "FAILED"
    ],
    default: "PENDING"
  },

  // ==========================
  // RECEIPT
  // ==========================

  receiptNo: {
    type: String,
    default: null
  },

  remarks: {
    type: String,
    default: ""
  }

},
  {
    timestamps: true
  });
// One paid record per subscription installment
paymentSchema.index(
  { subscription: 1, monthNo: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "PAID"
    }
  }
);

// Prevent duplicate Razorpay payment IDs
paymentSchema.index(
  { gatewayPaymentId: 1 },
  {
    unique: true,
    sparse: true
  }
);

module.exports =
  mongoose.model(
    "Payment",
    paymentSchema
  );
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  password: { type: String },
  googleId: { type: String },
  token: { type: String },

  gender: {
    type: String,
    enum: ["Male", "Female", "Other", ""],
    default: "",
  },

  dateOfBirth: { type: Date, default: null },
  anniversaryDate: { type: Date, default: null },

  addressLine1: { type: String, trim: true, default: "" },
  addressLine2: { type: String, trim: true, default: "" },
  city: { type: String, trim: true, default: "" },
  state: { type: String, trim: true, default: "" },
  pincode: { type: String, trim: true, default: "" },
  country: { type: String, trim: true, default: "India" },

  createdAt: { type: Date, default: Date.now },

  newPhone: { type: String },
  newEmail: { type: String },

  OTP: { type: String },
  isVerified: { type: Boolean, default: false },
  OTPExpires: { type: Date },
});

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);

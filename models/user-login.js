const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String, required: true },
  email: {
    type: String, 
  },
  password: {
    type: String, 
  },
  token: {
    type: String
  }
  ,
  createdAt: { type: Date, default: Date.now },
  newPhone: { type: String },
  newEmail: {
    type: String
  },
  OTP: { type: String },
  isVerified: {
    type: Boolean,
    default: false, 
  },
  OTPExpires: { type: Date },
});

// module.exports = mongoose.model("user", UserSchema);
module.exports =
  mongoose.models.User ||
  mongoose.model(
    "User",
    UserSchema
  );
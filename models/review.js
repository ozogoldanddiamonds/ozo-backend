const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  rating: {
    type: Number,
    required: true
  },

  title: String,

  text: String,

  tags: [String],

  images: [String],

  videos: [String]

}, {
  timestamps: true
});

module.exports =
  mongoose.models.Review ||
  mongoose.model("Review", reviewSchema);
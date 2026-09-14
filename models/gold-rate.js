const mongoose = require("mongoose");

const goldRateSchema = new mongoose.Schema(
{
  ratePerGram: {
    type: Number,
    required: [true, "Gold rate is required"]
  },

  history: [
    {
      rate: {
        type: Number
      },
      date: {
        type: Date,
        default: Date.now
      }
    }
  ],

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: [true, "Updated by is required"]
  }

},
{
  timestamps: true
});

module.exports =
  mongoose.models.GoldRate ||
  mongoose.model("GoldRate", goldRateSchema);
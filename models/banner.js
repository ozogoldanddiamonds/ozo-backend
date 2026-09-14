const mongoose =
  require("mongoose");

const bannerSchema =
  new mongoose.Schema(
    {
      image: {
        type: String,
        required: true
      },

      title: {
        type: String,
        required: true, unique: true,
      trim: true
      },

      description: {
        type: String,
        required: true
      }
    },
    {
      timestamps: true
    }
  );

module.exports =
  mongoose.models.Banner ||
  mongoose.model(
    "Banner",
    bannerSchema
  );
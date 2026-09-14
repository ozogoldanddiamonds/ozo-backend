const mongoose = require("mongoose");

const wishlistSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      items: [
        {
          product: {
            type:
              mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
          },

          variantId: {
            type:
              mongoose.Schema.Types.ObjectId
          }
        }
      ]
    },
    {
      timestamps: true
    }
  );

module.exports =
  mongoose.models.Wishlist ||
  mongoose.model(
    "Wishlist",
    wishlistSchema
  );
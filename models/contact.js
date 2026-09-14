const mongoose =
  require("mongoose");

const contactSchema =
  new mongoose.Schema(

    {

      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },

      name: {

        type: String,

        required: true,

        trim: true

      },

      email: {

        type: String,

        required: true,

        trim: true,

        lowercase: true

      },

      phone: {

        type: String,

        required: true

      },

      // OPTIONAL

      subject: {

        type: String,

        default: ""

      },

      // OPTIONAL

      message: {

        type: String,

        default: ""

      },

      isRead: {

        type: Boolean,

        default: false

      }

    },

    {

      timestamps: true

    }

  );

module.exports =
  mongoose.models.Contact ||
  mongoose.model(
    "Contact",
    contactSchema
  );
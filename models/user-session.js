const mongoose = require("mongoose");

const UserSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    deviceId: {
      type: String,
      required: true,
    },

    deviceName: {
      type: String,
      default: "Unknown Device",
    },

    platform: {
      type: String,
      enum: ["web", "android", "ios", "unknown"],
      default: "unknown",
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },

    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

UserSessionSchema.index({ userId: 1, revokedAt: 1 });

module.exports =
  mongoose.models.UserSession ||
  mongoose.model("UserSession", UserSessionSchema);

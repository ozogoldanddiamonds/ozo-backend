const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema({

  title: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },

 image: {
  type: String
},

  isActive: {
    type: Boolean,
    default: true
  }

}, { _id: false });

const adsSchema = new mongoose.Schema({

  section1: {
    type: sectionSchema,
    default: null
  },

  section2: {
    type: sectionSchema,
    default: null
  },

  section3: {
    type: sectionSchema,
    default: null
  }

 

}, {
  timestamps: true
});

module.exports = mongoose.model("Ads", adsSchema);
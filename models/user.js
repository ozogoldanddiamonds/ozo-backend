const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ['BRANCH', 'SUB_BRANCH'],
    default: 'SUB_BRANCH'
  },

   contactNumber: {
    type: String,
    default: ''
  },

  address: {
    type: String,
    default: ''
  },

  location: {
    type: String,
    default: ''
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: function () {
      return this.role === 'BRANCH'
        ? 'ACTIVE'
        : 'INACTIVE';
    }
  },

  permissions: {
    type: [String],
    default: []
  },

  resetToken: String,
  resetTokenExpire: Date,

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);

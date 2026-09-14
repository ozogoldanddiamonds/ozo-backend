const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({

  firstName: {
    type: String,
    required: true
  },

  lastName: {
    type: String,
    required: true
  },

  contactNumber: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: [
      'MANAGER',
      'SALES_EXECUTIVE',
      'CASHIER',
      'STAFF'
    ],
    required: true
  },

  subBranchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },

  photo: {
    type: String,
    default: ''
  },

  aadhaarImage: {
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

  status: {
    type: String,
    enum: [
      'ACTIVE',
      'INACTIVE'
    ],
    default: 'ACTIVE'
  },

  isActive: {
    type: Boolean,
    default: true
  }

},
{
  timestamps: true
});

module.exports =
  mongoose.model(
    'Employee',
    employeeSchema
  );
const Admin = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');


// REGISTER
// exports.register = async (req, res) => {
//   try {
//     const { name, email, password, role, permissions } = req.body;

//     const existingUser = await Admin.findOne({ email });

//     if (existingUser) {
//       return res.status(400).json({
//         message: 'User already exists'
//       });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await Admin.create({
//       name,
//       email,
//       password: hashedPassword,
//       role,
//       permissions
//     });

//     res.status(201).json({
//       message: 'Register Success',
//       user
//     });

//   } catch (error) {
//     res.status(500).json({
//       message: error.message
//     });
//   }
// };
exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      contactNumber,
      address,
      location,
      branchId
    } = req.body;

    const existingUser = await Admin.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
      contactNumber,
      address,
      location,
      permissions: []
    };

    if (role === "BRANCH") {
      userData.branchId = null;
      userData.status = "ACTIVE";
    }

    if (role === "SUB_BRANCH") {
      if (!branchId) {
        return res.status(400).json({
          message: "branchId is required for sub branch"
        });
      }

      const parentBranch = await Admin.findOne({
        _id: branchId,
        role: "BRANCH"
      });

      if (!parentBranch) {
        return res.status(400).json({
          message: "Invalid branch selected"
        });
      }

      userData.branchId = branchId;
      userData.status = "INACTIVE";
    }

    const user = await Admin.create(userData);

    res.status(201).json({
      message: `${role} Created Successfully`,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// LOGIN


// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const user = await Admin.findOne({ email });

//     if (!user) {
//       return res.status(404).json({
//         message: 'User not found'
//       });
//     }

//     const checkPassword = await bcrypt.compare(
//       password,
//       user.password
//     );

//     if (!checkPassword) {
//       return res.status(400).json({
//         message: 'Invalid password'
//       });
//     }

//     const token = jwt.sign(
//       {
//         id: user._id,
//         role: user.role,
//           branchId: user.branchId
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: '1d'
//       }
//     );

//     res.status(200).json({
//       message: 'Login Success',
//       token,
//         _id: user._id, 
//       role: user.role,
//        name: user.name,
//   email: user.email,
//       permissions: user.permissions
//     });

//   } catch (error) {
//     res.status(500).json({
//       message: error.message
//     });
//   }
// };

// LOGIN
exports.login = async (req, res) => {
  try {

    const { email, password } = req.body;

    const user = await Admin.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const checkPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!checkPassword) {
      return res.status(400).json({
        message: 'Invalid password'
      });
    }

    // ==========================
    // ADD THIS BLOCK HERE
    // ==========================

    if (
      user.role === "SUB_BRANCH" &&
      user.status === "INACTIVE"
    ) {
      return res.status(403).json({
        message: "Your account is inactive. Please contact Branch Admin."
      });
    }

    // ==========================
    // JWT TOKEN
    // ==========================

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        branchId: user.branchId
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    res.status(200).json({
      message: 'Login Success',
      token,
      _id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      permissions: user.permissions
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};


exports.getBranchList = async (req, res) => {

  try {

    const branches = await Admin.find(
      { role: 'BRANCH' }
    ).select(
      'name email contactNumber address location status'
    );

    res.status(200).json({
      success: true,
      message: 'Branch List Fetched Successfully',
      data: branches
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};
exports.getAllSubBranches = async (req, res) => {

  try {

    const subBranches =
      await Admin.find({

        role: 'SUB_BRANCH',

        isActive: true

      })
        .populate({
          path: 'branchId',
          select: 'name email'
        })
        .sort({ createdAt: -1 })
        .lean();

    res.status(200).json({

      success: true,

      data: subBranches

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};
exports.updateSubBranch = async (req, res) => {
  try {

    const id = req.params.id;

    const existingUser = await Admin.findById(id);

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const updateData = { ...req.body };

    // ==========================================
    // BRANCH ID
    // ==========================================

    if (
      updateData.branchId === "" ||
      updateData.branchId === undefined
    ) {
      delete updateData.branchId;
    }

    // ==========================================
    // ROLE = BRANCH
    // ==========================================

    if (updateData.role === "BRANCH") {
      updateData.branchId = null;
      updateData.status = "ACTIVE";
    }

    // ==========================================
    // ROLE = SUB_BRANCH
    // ==========================================

    if (updateData.role === "SUB_BRANCH") {

      // If branchId is not sent in request,
      // use existing branchId
      if (!updateData.branchId) {
        updateData.branchId = existingUser.branchId;
      }

      if (!updateData.branchId) {
        return res.status(400).json({
          message: "branchId is required for sub branch"
        });
      }

      // Verify selected branch really exists
      const parentBranch = await Admin.findOne({
        _id: updateData.branchId,
        role: "BRANCH"
      });

      if (!parentBranch) {
        return res.status(400).json({
          message: "Invalid branch selected"
        });
      }
    }

    // ==========================================
    // PASSWORD HASHING
    // ==========================================

    if (updateData.password && updateData.password.trim() !== "") {

      updateData.password = await bcrypt.hash(
        updateData.password,
        10
      );

    } else {

      // Password empty/not provided means
      // don't change existing password
      delete updateData.password;

    }

    // ==========================================
    // UPDATE
    // ==========================================

    const user = await Admin.findByIdAndUpdate(
      id,
      { $set: updateData },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      message: "Sub Branch Updated Successfully",
      user
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
};
// exports.updateSubBranch = async (req, res) => {

//   try {

//     const { id } = req.params;

//     const {
//       name,
//       email,
//       password,
//       contactNumber,
//       address,
//       location,
//       status
//     } = req.body;

//     const updateData = {

//       name,
//       email,
//       contactNumber,
//       address,
//       location,
//       status

//     };

//     // Password update optional

//     if (password) {

//       updateData.password =
//         await bcrypt.hash(password, 10);

//     }

//     const user =
//       await Admin.findByIdAndUpdate(

//         id,

//         updateData,

//         {
//           new: true,
//           runValidators: true
//         }

//       );

//     if (!user) {

//       return res.status(404).json({

//         message: 'Sub Branch Not Found'

//       });

//     }

//     res.status(200).json({

//       message:
//         'Sub Branch Updated Successfully',

//       user

//     });

//   }

//   catch (error) {

//     res.status(500).json({

//       message: error.message

//     });

//   }

// };
exports.getSubBranchById = async (req, res) => {

  try {

    const { id } = req.params;

    const subBranch =
      await Admin.findOne({

        _id: id,

        role: 'SUB_BRANCH'

      }).select('-password');

    if (!subBranch) {

      return res.status(404).json({

        message: 'Sub Branch Not Found'

      });

    }

    res.status(200).json({

      success: true,

      data: subBranch

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

exports.deleteSubBranch = async (req, res) => {

  try {

    const { id } = req.params;

    const subBranch =
      await Admin.findOneAndUpdate(

        {
          _id: id,
          role: 'SUB_BRANCH'
        },

        {
          isActive: false
        },

        {
          new: true
        }

      );

    if (!subBranch) {

      return res.status(404).json({

        success: false,

        message: 'Sub Branch Not Found'

      });

    }

    res.status(200).json({

      success: true,

      message: 'Sub Branch Deleted Successfully'

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};



exports.updateSubBranchStatus = async (req, res) => {
  try {

    const { id } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Status"
      });
    }

    const subBranch = await Admin.findById(id);

    if (!subBranch) {
      return res.status(404).json({
        success: false,
        message: "Sub Branch not found"
      });
    }

    // BRANCH status change cheyyakudadhu
    if (subBranch.role !== "SUB_BRANCH") {
      return res.status(400).json({
        success: false,
        message: "Only Sub Branch status can be updated"
      });
    }

    subBranch.status = status;

    await subBranch.save();

    return res.status(200).json({
      success: true,
      message: `Sub Branch ${status} Successfully`,
      data: subBranch
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await Admin.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: 'Email not found'
      });
    }

    const resetToken = crypto
      .randomBytes(32)
      .toString('hex');

    user.resetToken = resetToken;

    user.resetTokenExpire =
      Date.now() + 10 * 60 * 1000;

    await user.save();

    res.status(200).json({
      message: 'Reset token generated',
      resetToken
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};


// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await Admin.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired token'
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;

    await user.save();

    res.status(200).json({
      message: 'Password reset successful'
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
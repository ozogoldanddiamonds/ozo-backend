const Employee = require('../models/employee');
const cloudinary = require('../cloudinaryconfig');
const Admin = require("../models/user");

// exports.createEmployee = async (req, res) => {

//   try {

//     const {
//       firstName,
//       lastName,
//       contactNumber,
//       role,
//       subBranchId,
//       address,
//       location,
//       status
//     } = req.body;

//     // Validation

//     if (
//       !firstName ||
//       !lastName ||
//       !contactNumber ||
//       !role ||
//       !subBranchId
//     ) {

//       return res.status(400).json({

//         success: false,

//         message:
//           'Please fill all required fields'

//       });

//     }

//     let photoUrl = '';

//     let aadhaarUrl = '';

//     // Employee Photo Upload

//     if (req.files?.photo?.[0]) {

//       const result =
//         await new Promise(
//           (resolve, reject) => {

//             cloudinary.uploader.upload_stream(

//               {
//                 folder:
//                   'employees/photo'
//               },

//               (error, result) => {

//                 if (error)
//                   reject(error);

//                 else
//                   resolve(result);

//               }

//             ).end(
//               req.files.photo[0].buffer
//             );

//           }
//         );

//       photoUrl =
//         result.secure_url;

//     }

//     // Aadhaar Upload

//     if (
//       req.files?.aadhaarImage?.[0]
//     ) {

//       const result =
//         await new Promise(
//           (resolve, reject) => {

//             cloudinary.uploader.upload_stream(

//               {
//                 folder:
//                   'employees/aadhaar'
//               },

//               (error, result) => {

//                 if (error)
//                   reject(error);

//                 else
//                   resolve(result);

//               }

//             ).end(
//               req.files.aadhaarImage[0].buffer
//             );

//           }
//         );

//       aadhaarUrl =
//         result.secure_url;

//     }

//     const employee =
//       await Employee.create({

//         firstName,

//         lastName,

//         contactNumber,

//         role,

//         subBranchId,

//         address,

//         location,

//         status,

//         photo: photoUrl,

//         aadhaarImage:
//           aadhaarUrl

//       });

//     res.status(201).json({

//       success: true,

//       message:
//         'Employee Created Successfully',

//       data: employee

//     });

//   }

//   catch (error) {

//     res.status(500).json({

//       success: false,

//       message:
//         error.message

//     });

//   }

// };


// =====================
// GET ALL EMPLOYEES
// =====================

exports.getAllEmployees = async (req, res) => {

  try {

    const employees =
      await Employee.find({

        isActive: true

      })

      .populate(
        'subBranchId',
        'name'
      )

      .sort({
        createdAt: -1
      });

    res.status(200).json({

      success: true,

      count:
        employees.length,

      data: employees

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};


// =====================
// GET EMPLOYEE BY ID
// =====================

exports.getEmployeeById = async (req, res) => {

  try {

    const employee =
      await Employee.findById(
        req.params.id
      )

      .populate(
        'subBranchId',
        'name'
      );

    if (!employee) {

      return res.status(404).json({

        message:
          'Employee Not Found'

      });

    }

    res.status(200).json({

      success: true,

      data: employee

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};


// =====================
// UPDATE EMPLOYEE
// =====================

exports.updateEmployee = async (req, res) => {

  try {

    const { id } = req.params;

    const {

      firstName,

      lastName,

      contactNumber,

      role,

      subBranchId,

      address,

      location,

      status,

      isActive

    } = req.body;

    const employee =
      await Employee.findById(id);

    if (!employee) {

      return res.status(404).json({

        success: false,

        message: "Employee not found"

      });

    }

    // Duplicate Contact Check

    const existingEmployee =
      await Employee.findOne({

        contactNumber,

        _id: { $ne: id }

      });

    if (existingEmployee) {

      return res.status(400).json({

        success: false,

        message: "Contact Number already exists"

      });

    }

    // ==========================
    // Update Photo
    // ==========================

    let photoUrl =
      employee.photo;

    if (req.files?.photo) {

      const result =
        await new Promise(

          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {

                folder: "employees/photo"

              },

              (error, result) => {

                if (error)

                  reject(error);

                else

                  resolve(result);

              }

            ).end(

              req.files.photo[0].buffer

            );

          }

        );

      photoUrl =
        result.secure_url;

    }

    // ==========================
    // Update Aadhaar
    // ==========================

    let aadhaarUrl =
      employee.aadhaarImage;

    if (req.files?.aadhaarImage) {

      const result =
        await new Promise(

          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {

                folder: "employees/aadhaar"

              },

              (error, result) => {

                if (error)

                  reject(error);

                else

                  resolve(result);

              }

            ).end(

              req.files.aadhaarImage[0].buffer

            );

          }

        );

      aadhaarUrl =
        result.secure_url;

    }

    // ==========================
    // Update Employee
    // ==========================

    employee.firstName =
      firstName;

    employee.lastName =
      lastName;

    employee.contactNumber =
      contactNumber;

    employee.role =
      role;

    employee.subBranchId =
      subBranchId;

    employee.address =
      address;

    employee.location =
      location;

    employee.status =
      status;

    employee.isActive =
      isActive;

    employee.photo =
      photoUrl;

    employee.aadhaarImage =
      aadhaarUrl;

    await employee.save();

    res.status(200).json({

      success: true,

      message:
        "Employee Updated Successfully",

      data: employee

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};


// =====================
// UPDATE STATUS
// =====================

exports.updateEmployeeStatus = async (req, res) => {

  try {

    const employee =
      await Employee.findByIdAndUpdate(

        req.params.id,

        {

          status:
            req.body.status

        },

        {

          new: true

        }

      );

    res.status(200).json({

      success: true,

      message:
        'Status Updated Successfully',

      data: employee

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};


// =====================
// DELETE EMPLOYEE
// SOFT DELETE
// =====================

exports.deleteEmployee = async (req, res) => {

  try {

    const employee =
      await Employee.findByIdAndUpdate(

        req.params.id,

        {

          isActive: false

        },

        {

          new: true

        }

      );

    if (!employee) {

      return res.status(404).json({

        message:
          'Employee Not Found'

      });

    }

    res.status(200).json({

      success: true,

      message:
        'Employee Deleted Successfully'

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/*
=================================
CREATE EMPLOYEE
=================================
*/
exports.createEmployee = async (req, res) => {

  try {

    const {
      firstName,
      lastName,
      contactNumber,
      role,
      subBranchId,
      address,
      location
    } = req.body;

    // Validation

    if (
      !firstName ||
      !lastName ||
      !contactNumber ||
      !role ||
      !subBranchId
    ) {

      return res.status(400).json({

        success: false,

        message: "Please fill all required fields"

      });

    }

    // Duplicate Contact Number

    const existingEmployee = await Employee.findOne({

      contactNumber

    });

    if (existingEmployee) {

      return res.status(400).json({

        success: false,

        message: "Employee already exists"

      });

    }

    let photoUrl = "";

    let aadhaarUrl = "";

    // ===========================
    // Upload Employee Photo
    // ===========================

    if (req.files && req.files.photo) {

      const photoResult =
        await new Promise(

          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {

                folder: "employees/photo"

              },

              (error, result) => {

                if (error)
                  reject(error);

                else
                  resolve(result);

              }

            ).end(req.files.photo[0].buffer);

          }

        );

      photoUrl =
        photoResult.secure_url;

    }

    // ===========================
    // Upload Aadhaar Image
    // ===========================

    if (req.files && req.files.aadhaarImage) {

      const aadhaarResult =
        await new Promise(

          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {

                folder: "employees/aadhaar"

              },

              (error, result) => {

                if (error)
                  reject(error);

                else
                  resolve(result);

              }

            ).end(req.files.aadhaarImage[0].buffer);

          }

        );

      aadhaarUrl =
        aadhaarResult.secure_url;

    }

    // ===========================
    // Save Employee
    // ===========================

    const employee =
      await Employee.create({

        firstName,

        lastName,

        contactNumber,

        role,

        subBranchId,

        address,

        location,

        photo: photoUrl,

        aadhaarImage: aadhaarUrl

      });

    res.status(201).json({

      success: true,

      message: "Employee Created Successfully",

      data: employee

    });

  }

  catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

exports.getEmployeesByBranch = async (req, res) => {

    try {

        const branchId = req.user.id;

        // Branch ki sambandhinchina sub branches
        const subBranches = await Admin.find({

            role: "SUB_BRANCH",

            branchId: branchId,

            isActive: true

        }).select("_id name");

        const subBranchIds = subBranches.map(item => item._id);

        // Employees
        const employees = await Employee.find({

            subBranchId: {

                $in: subBranchIds

            },

            isActive: true

        })

        .populate({

            path: "subBranchId",

            select: "name"

        })

        .sort({

            createdAt: -1

        });

        res.status(200).json({

            success: true,

            count: employees.length,

            data: employees

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};
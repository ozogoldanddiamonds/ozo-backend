const SubSubCategory = require("../models/sub-sub-category");
const cloudinary = require("../cloudinaryconfig");
const mongoose =
  require("mongoose");


/*
=====================================
CREATE SUB SUB CATEGORY
=====================================
*/

exports.createSubSubCategory = async (req, res) => {

  try {

    const {
      name,
      category,
      subCategory,
      isActive
    } = req.body;

    // VALIDATION

    if (!name || !category || !subCategory) {

      return res.status(400).json({

        success: false,

        message:
          "Name, Category and SubCategory are required"

      });

    }

    // DUPLICATE CHECK

    const existingSubSubCategory =
      await SubSubCategory.findOne({

        name: {
          $regex: new RegExp(
            `^${name.trim()}$`,
            "i"
          )
        }

      });

    if (existingSubSubCategory) {

      return res.status(409).json({

        success: false,

        message:
          `SubSubCategory '${name}' already exists. Please use a different name.`

      });

    }

    let imageUrl = "";

    if (req.file) {

      const result =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {
                folder: "subsubcategory"
              },

              (error, result) => {

                if (error)
                  reject(error);

                else
                  resolve(result);

              }

            ).end(req.file.buffer);

          }
        );

      imageUrl =
        result.secure_url;

    }

    const subSubCategory =
      await SubSubCategory.create({

        name: name.trim(),

        image: imageUrl,

        category,

        subCategory,

        isActive

      });

    res.status(201).json({

      success: true,

      message:
        "SubSubCategory created successfully",

      data:
        subSubCategory

    });

  } catch (error) {

    if (error.code === 11000) {

      return res.status(409).json({

        success: false,

        message:
          "SubSubCategory already exists. Please use a different name."

      });

    }

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};



/*
 GET ALL SUB SUB CATEGORY
*/
exports.getAllSubSubCategories = async (req, res) => {
  try {
    const subSubCategories =
      await SubSubCategory.find()
        .populate("category")
        .populate("subCategory");

    res.status(200).json({
      success: true,
      message: "SubSubCategories fetched successfully",
      data: subSubCategories
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
 GET SINGLE SUB SUB CATEGORY
*/
exports.getSubSubCategoryById = async (req, res) => {
  try {
    const subSubCategory =
      await SubSubCategory.findById(req.params.id)
        .populate("category")
        .populate("subCategory");

    if (!subSubCategory) {
      return res.status(404).json({
        success: false,
        message: "SubSubCategory not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "SubSubCategory fetched successfully",
      data: subSubCategory
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
 UPDATE SUB SUB CATEGORY
*/
exports.updateSubSubCategory = async (req, res) => {

  try {

    const subSubCategory =
      await SubSubCategory.findById(
        req.params.id
      );

    if (!subSubCategory) {

      return res.status(404).json({

        success: false,

        message:
          "SubSubCategory not found"

      });

    }

    const {
      name,
      category,
      subCategory,
      isActive
    } = req.body;

    // CATEGORY VALIDATION

    if (
      category &&
      !mongoose.Types.ObjectId.isValid(
        category
      )
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Invalid Category selected."

      });

    }

    // SUBCATEGORY VALIDATION

    if (
      subCategory &&
      !mongoose.Types.ObjectId.isValid(
        subCategory
      )
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Invalid SubCategory selected."

      });

    }

    // DUPLICATE CHECK

    if (
      name &&
      name.trim()
    ) {

      const existingSubSubCategory =
        await SubSubCategory.findOne({

          name: {
            $regex: new RegExp(
              `^${name.trim()}$`,
              "i"
            )
          },

          _id: {
            $ne: req.params.id
          }

        });

      if (existingSubSubCategory) {

        return res.status(409).json({

          success: false,

          message:
            `SubSubCategory '${name}' already exists. Please use a different name.`

        });

      }

    }

    let imageUrl =
      subSubCategory.image;

    if (req.file) {

      const result =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {
                folder: "subsubcategory"
              },

              (error, result) => {

                if (error)
                  reject(error);

                else
                  resolve(result);

              }

            ).end(req.file.buffer);

          }
        );

      imageUrl =
        result.secure_url;

    }

    subSubCategory.name =
      name?.trim() ||
      subSubCategory.name;

    subSubCategory.category =
      category ||
      subSubCategory.category;

    subSubCategory.subCategory =
      subCategory ||
      subSubCategory.subCategory;

    subSubCategory.image =
      imageUrl;

    subSubCategory.isActive =
      isActive ??
      subSubCategory.isActive;

    await subSubCategory.save();

    res.status(200).json({

      success: true,

      message:
        "SubSubCategory updated successfully",

      data:
        subSubCategory

    });

  } catch (error) {

    if (error.code === 11000) {

      return res.status(409).json({

        success: false,

        message:
          "SubSubCategory already exists. Please use a different name."

      });

    }

    if (error.name === "CastError") {

      return res.status(400).json({

        success: false,

        message:
          "Invalid Category or SubCategory selected."

      });

    }

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};



/*
 DELETE SUB SUB CATEGORY
*/
exports.deleteSubSubCategory = async (req, res) => {
  try {
    const subSubCategory =
      await SubSubCategory.findByIdAndDelete(
        req.params.id
      );

    if (!subSubCategory) {
      return res.status(404).json({
        success: false,
        message: "SubSubCategory not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "SubSubCategory deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// =========================================
// GET SUB SUB CATEGORY BY SUB CATEGORY
// =========================================

exports.getSubSubCategoryBySubCategory =
  async (req, res) => {

    try {

      const {
        subCategoryId
      } = req.params;

      const subSubCategories =
        await SubSubCategory.find({

          subCategory: subCategoryId,

          isActive: true

        })

        .populate("category")

        .populate("subCategory")

        .sort({
          createdAt: -1
        });

      res.status(200).json({

        success: true,

        count:
          subSubCategories.length,

        data:
          subSubCategories

      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

};
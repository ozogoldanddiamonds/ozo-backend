const SubCategory = require("../models/sub-category");
const cloudinary = require("../cloudinaryconfig");


/*
=================================
CREATE SUBCATEGORY
=================================
*/

exports.createSubCategory = async (req, res) => {

  try {

    const { name, category, isActive } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "SubCategory name is required"
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    // =========================
    // DUPLICATE CHECK
    // =========================

    const existingSubCategory =
      await SubCategory.findOne({

        name: {
          $regex: new RegExp(
            `^${name.trim()}$`,
            "i"
          )
        }

      });

    if (existingSubCategory) {

      return res.status(409).json({

        success: false,

        message:
          `SubCategory '${name}' already exists. Please use a different name.`

      });

    }

    let imageUrl = "";

    if (req.file) {

      const result =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {
                folder: "subcategory"
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

      imageUrl = result.secure_url;

    }

    const subCategory =
      await SubCategory.create({

        name: name.trim(),

        image: imageUrl,

        category,

        isActive

      });

    res.status(201).json({

      success: true,

      message:
        "SubCategory created successfully",

      data:
        subCategory

    });

  } catch (error) {

    if (error.code === 11000) {

      return res.status(409).json({

        success: false,

        message:
          "SubCategory already exists. Please use a different name."

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
 GET ALL SUBCATEGORY
*/
exports.getAllSubCategories = async (req, res) => {
  try {
    const subCategories =
      await SubCategory.find()
        .populate("category");

    res.status(200).json({
      success: true,
      data: subCategories
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
 GET SINGLE SUBCATEGORY
*/
exports.getSubCategoryById = async (req, res) => {
  try {
    const subCategory =
      await SubCategory.findById(req.params.id)
        .populate("category");

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found"
      });
    }

    res.status(200).json({
      success: true,
      data: subCategory
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
 UPDATE SUBCATEGORY
*/
exports.updateSubCategory  = async (req, res) => {
  try {

    const subCategory = await SubCategory.findById(
      req.params.id
    );

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found"
      });
    }

    const { name, category, isActive } = req.body;

    // ==========================
    // DUPLICATE CHECK
    // ==========================

    if (name && name.trim()) {

      const existingSubCategory =
        await SubCategory.findOne({

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

      if (existingSubCategory) {

        return res.status(409).json({

          success: false,

          message:
            `SubCategory '${name}' already exists. Please use a different SubCategory name.`

        });

      }

    }

    // ==========================
    // IMAGE UPLOAD
    // ==========================

    let imageUrl = subCategory.image;

    if (req.file) {

      const result =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {
                folder: "subcategory"
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

      imageUrl = result.secure_url;

    }

    // ==========================
    // UPDATE DATA
    // ==========================

    subCategory.name =
      name?.trim() ||
      subCategory.name;

    subCategory.category =
      category ||
      subCategory.category;

    subCategory.image =
      imageUrl;

    subCategory.isActive =
      isActive ??
      subCategory.isActive;

    await subCategory.save();

    res.status(200).json({

      success: true,

      message:
        "SubCategory updated successfully",

      data:
        subCategory

    });

  } catch (error) {

    console.error(
      "Update SubCategory Error:",
      error
    );

    if (error.code === 11000) {

      return res.status(409).json({

        success: false,

        message:
          "SubCategory already exists. Please use a different SubCategory name."

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
 DELETE SUBCATEGORY
*/
exports.deleteSubCategory = async (req, res) => {
  try {
    const subCategory =
      await SubCategory.findByIdAndDelete(
        req.params.id
      );

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "SubCategory deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// =========================================
// GET SUB CATEGORY BY CATEGORY
// =========================================

exports.getSubCategoryByCategory =
  async (req, res) => {

    try {

      const {
        categoryId
      } = req.params;

      const subCategories =
        await SubCategory.find({

          category: categoryId,

          isActive: true

        })

        .populate("category")

        .sort({
          createdAt: -1
        });

      res.status(200).json({

        success: true,

        count:
          subCategories.length,

        data:
          subCategories

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
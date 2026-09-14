const Category = require("../models/category");
const cloudinary = require("../cloudinaryconfig");

/*
=================================
CREATE CATEGORY
=================================
*/
exports.createCategory = async (req, res) => {
  try {

    const { name, isActive } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    // Duplicate Check
    const existingCategory = await Category.findOne({
      name: {
        $regex: new RegExp(`^${name.trim()}$`, "i")
      }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category already exists"
      });
    }

    let imageUrl = "";

    // Upload Image
    if (req.file) {

      const result = await new Promise(
        (resolve, reject) => {

          cloudinary.uploader.upload_stream(
            {
              folder: "categories"
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

    const category = await Category.create({
      name: name.trim(),
      image: imageUrl,
      isActive
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });

  } catch (error) {

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Category already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/*
=================================
GET ALL CATEGORIES
=================================
*/
exports.getAllCategories = async (req, res) => {
  try {

    const categories = await Category.find();

    res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categories
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


/*
=================================
GET CATEGORY BY ID
=================================
*/
exports.getCategoryById = async (req, res) => {
  try {

    const category = await Category.findById(
      req.params.id
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      data: category
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


/*
=================================
UPDATE CATEGORY
=================================
*/
exports.updateCategory = async (req, res) => {
  try {

    const category = await Category.findById(
      req.params.id
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const { name, isActive } = req.body;

    // ==========================
    // DUPLICATE CHECK
    // ==========================

    if (name && name.trim()) {

      const existingCategory =
        await Category.findOne({

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

      if (existingCategory) {

        return res.status(409).json({

          success: false,

          message:
            `Category '${name}' already exists. Please use a different category name.`

        });

      }

    }

    // ==========================
    // IMAGE UPLOAD
    // ==========================

    let imageUrl = category.image;

    if (req.file) {

      const result =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {
                folder: "categories"
              },

              (error, result) => {

                if (error)
                  reject(error);

                else
                  resolve(result);

              }

            ).end(
              req.file.buffer
            );

          }
        );

      imageUrl =
        result.secure_url;

    }

    // ==========================
    // UPDATE DATA
    // ==========================

    category.name =
      name?.trim() ||
      category.name;

    category.image =
      imageUrl;

    category.isActive =
      isActive ??
      category.isActive;

    await category.save();

    res.status(200).json({

      success: true,

      message:
        "Category updated successfully",

      data:
        category

    });

  } catch (error) {

    console.error(
      "Update Category Error:",
      error
    );

    if (
      error.code === 11000
    ) {

      return res.status(409).json({

        success: false,

        message:
          "Category already exists. Please use a different category name."

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
=================================
DELETE CATEGORY
=================================
*/
exports.deleteCategory = async (req, res) => {
  try {

    const category =
      await Category.findByIdAndDelete(
        req.params.id
      );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};
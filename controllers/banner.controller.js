const Banner = require("../models/banner");
const cloudinary = require("../cloudinaryconfig");

/*
=================================
CREATE BANNER
=================================
*/
exports.createBanner = async (req, res) => {
  try {

    const { title, description } = req.body;

    // Duplicate Check FIRST
    const existingBanner = await Banner.findOne({
      title: {
        $regex: new RegExp(`^${title.trim()}$`, "i")
      }
    });

    if (existingBanner) {
      return res.status(400).json({
        success: false,
        message: "Banner title already exists"
      });
    }

    let imageUrl = "";

    if (req.file) {

      const result = await new Promise((resolve, reject) => {

        cloudinary.uploader.upload_stream(
          { folder: "banners" },
          (error, result) => {

            if (error) reject(error);
            else resolve(result);

          }
        ).end(req.file.buffer);

      });

      imageUrl = result.secure_url;
    }

    const banner = await Banner.create({
      image: imageUrl,
      title,
      description
    });

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner
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
UPDATE BANNER
=================================
*/
exports.updateBanner = async (req, res) => {
  try {

    const banner = await Banner.findById(
      req.params.id
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    const { title, description } = req.body;

    // Duplicate Check
    if (title) {

      const existingBanner =
        await Banner.findOne({

          title: {
            $regex: new RegExp(
              `^${title.trim()}$`,
              "i"
            )
          },

          _id: {
            $ne: req.params.id
          }

        });

      if (existingBanner) {
        return res.status(400).json({
          success: false,
          message: "Banner title already exists"
        });
      }

    }

    let imageUrl = banner.image;

    if (req.file) {

      const result =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(
              {
                folder: "banners"
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

    banner.title =
      title?.trim() || banner.title;

    banner.description =
      description || banner.description;

    banner.image = imageUrl;

    await banner.save();

    res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: banner
    });

  } catch (error) {

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Banner title already exists"
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
GET ALL BANNERS
=================================
*/
exports.getAllBanners = async (req, res) => {
  try {

    const banners = await Banner.find();

    res.status(200).json({
      success: true,
      message: "Banners fetched successfully",
      data: banners
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
GET BANNER BY ID
=================================
*/
exports.getBannerById = async (req, res) => {
  try {

    const banner = await Banner.findById(
      req.params.id
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Banner fetched successfully",
      data: banner
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
DELETE BANNER
=================================
*/
exports.deleteBanner = async (req, res) => {
  try {

    const banner =
      await Banner.findByIdAndDelete(
        req.params.id
      );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
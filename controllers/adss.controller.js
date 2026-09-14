const Ads = require("../models/adds");
const cloudinary = require("../cloudinaryconfig");
exports.createAds = async (req, res) => {
  try {

    let section1Image = "";
    let section2Image = "";
    let section3Image = "";

    if (req.files?.section1Images?.[0]) {

      const result = await new Promise((resolve, reject) => {

        cloudinary.uploader.upload_stream(
          { folder: "ads" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.files.section1Images[0].buffer);

      });

      section1Image = result.secure_url;
    }

    if (req.files?.section2Images?.[0]) {

      const result = await new Promise((resolve, reject) => {

        cloudinary.uploader.upload_stream(
          { folder: "ads" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.files.section2Images[0].buffer);

      });

      section2Image = result.secure_url;
    }

    if (req.files?.section3Images?.[0]) {

      const result = await new Promise((resolve, reject) => {

        cloudinary.uploader.upload_stream(
          { folder: "ads" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.files.section3Images[0].buffer);

      });

      section3Image = result.secure_url;
    }

    const ads = await Ads.create({

      section1: {
        title: req.body.section1Title,
        description: req.body.section1Description,
        image: section1Image
      },

      section2: {
        title: req.body.section2Title,
        description: req.body.section2Description,
        image: section2Image
      },

      section3: {
        title: req.body.section3Title,
        description: req.body.section3Description,
        image: section3Image
      }

    });

    return res.status(201).json({
      success: true,
      message: "Ads created successfully",
      data: ads
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

exports.getAllAds = async (
  req,
  res
) => {

  try {

    const ads =
      await Ads.find()
      .sort({
        createdAt: -1
      });

    res.status(200).json({

      success: true,

      count: ads.length,

      data: ads

    });

  }
  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};
exports.getAdsById = async (req, res) => {
  try {

    const ads = await Ads.findById(req.params.id);

    if (!ads) {
      return res.status(404).json({
        success: false,
        message: "Ads not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: ads
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};
exports.updateSection = async (req, res) => {
  try {

    const { id } = req.params;
    const { section, title, description } = req.body;

    const ads = await Ads.findById(id);

    if (!ads) {
      return res.status(404).json({
        success: false,
        message: "Ads not found"
      });
    }

    ads[section].title = title;
    ads[section].description = description;

    if (req.file) {

      const result = await new Promise((resolve, reject) => {

        cloudinary.uploader.upload_stream(
          { folder: "ads" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);

      });

      ads[section].image = result.secure_url;
    }

    await ads.save();

    return res.status(200).json({
      success: true,
      message: `${section} updated successfully`,
      data: ads
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};
exports.deleteAds = async (
  req,
  res
) => {

  try {

    const ads =
      await Ads.findByIdAndDelete(
        req.params.id
      );

    if (!ads) {

      return res.status(404).json({

        success: false,

        message:
          "Ads not found"

      });

    }

    res.status(200).json({

      success: true,

      message:
        "Ads deleted successfully"

    });

  }
  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

exports.updateAdsStatus = async (
  req,
  res
) => {

  try {

    const { id } =
      req.params;

    const {
      section,
      isActive
    } = req.body;

    const ads =
      await Ads.findById(id);

    if (!ads) {

      return res.status(404).json({

        success: false,

        message:
          "Ads not found"

      });

    }

    ads[section].isActive =
      isActive;

    await ads.save();

    return res.status(200).json({

      success: true,

      message:
        "Status Updated Successfully"

    });

  }
  catch (error) {

    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};
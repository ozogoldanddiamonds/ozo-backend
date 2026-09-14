const cloudinary = require("../cloudinaryconfig");

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    console.log("Uploading file:", req.file.originalname);

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "uploads" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Upload Error:", error);
          return res.status(500).json({ success: false, message: "Upload failed", error: error.message });
        }

        res.json({
          success: true,
          message: "Image uploaded successfully!",
          imageUrl: result.secure_url,
        });
      }
    );

    uploadStream.end(req.file.buffer); 

  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ success: false, message: "Upload failed", error: error.message });
  }
};

// =========================
// VIDEO UPLOAD
// =========================

const videoResult =
  await new Promise(
    (resolve, reject) => {

      cloudinary.uploader.upload_stream(

        {

          folder: "videos",

          resource_type: "auto"

        },

        (error, result) => {

          if (error)
            reject(error);

          else
            resolve(result);

        }

      ).end(videoFile.buffer);

    }
  );

videoUrl =
  videoResult.secure_url;

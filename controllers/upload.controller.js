const cloudinary =
require("../cloudinaryconfig");

/*
UPLOAD CERTIFICATE
*/
exports.uploadCertificate =
async (req, res) => {

  try {

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No file uploaded"

      });

    }

    /*
    CLOUDINARY UPLOAD
    */
    const result =
      await new Promise(
        (resolve, reject) => {

        cloudinary
          .uploader
          .upload_stream(

          {
            folder:
              "certificates",

            resource_type:
              "auto"
          },

          (
            error,
            result
          ) => {

            if (error)
              reject(error);

            else
              resolve(result);

          }

        )
        .end(req.file.buffer);

      });

    res.status(200).json({

      success: true,

      message:
        "Certificate uploaded successfully",

      fileUrl:
        result.secure_url

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};
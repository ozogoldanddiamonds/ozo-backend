const mongoose = require("mongoose");
const CustomDesignRequest = require("../models/custom-desing-request");
const Category = require("../models/category");
const SubCategory = require("../models/sub-category");
const SubSubCategory = require("../models/sub-sub-category");
const cloudinary = require("../cloudinaryconfig");



const generateRequestNumber = async () => {
  const lastRequest = await CustomDesignRequest
    .findOne({})
    .sort({ createdAt: -1 })
    .select("requestNumber");

  let nextNumber = 1;

  if (lastRequest?.requestNumber) {
    const match = lastRequest.requestNumber.match(/(\d+)$/);

    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `CR-${String(nextNumber).padStart(5, "0")}`;
};








exports.createCustomDesignRequest = async (req, res) => {
  try {

    // =========================
    // CUSTOMER AUTHENTICATION
    // =========================

    const customerId =
      req.user?.userId ||
      req.user?.id ||
      req.user?._id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required"
      });
    }


    // =========================
    // REQUEST BODY
    // =========================

    const {
      category,
      subCategory,
      subSubCategory,
      description,
      metalType,
      metalPurity,
      metalColor,
      stonePreference,
      budget,
      requiredDate
    } = req.body;


    // =========================
    // REQUIRED VALIDATION
    // =========================

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    if (!subCategory) {
      return res.status(400).json({
        success: false,
        message: "Sub category is required"
      });
    }

    if (!subSubCategory) {
      return res.status(400).json({
        success: false,
        message: "Sub sub category is required"
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Design description is required"
      });
    }


    // =========================
    // OBJECT ID VALIDATION
    // =========================

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(subCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub category"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(subSubCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub sub category"
      });
    }


    // =========================
    // CATEGORY VALIDATION
    // =========================

    const categoryDoc = await Category.findOne({
      _id: category,
      isActive: true
    });

    if (!categoryDoc) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }


    const subCategoryDoc = await SubCategory.findOne({
      _id: subCategory,
      category: category,
      isActive: true
    });

    if (!subCategoryDoc) {
      return res.status(404).json({
        success: false,
        message: "Sub category does not belong to selected category"
      });
    }


    const subSubCategoryDoc = await SubSubCategory.findOne({
      _id: subSubCategory,
      category: category,
      subCategory: subCategory,
      isActive: true
    });

    if (!subSubCategoryDoc) {
      return res.status(404).json({
        success: false,
        message:
          "Sub sub category does not belong to selected category/sub category"
      });
    }


    // =========================
    // CLOUDINARY IMAGE UPLOAD
    // =========================

    const referenceImages = [];

    if (req.files && req.files.length > 0) {

      for (const file of req.files) {

        try {

          const uploadResult = await new Promise((resolve, reject) => {

            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: "custom-design",
                resource_type: "image"
              },
              (error, result) => {

                if (error) {
                  reject(error);
                } else {
                  resolve(result);
                }

              }
            );

            uploadStream.end(file.buffer);

          });


          referenceImages.push({
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id
          });


        } catch (uploadError) {

          console.error(
            "Cloudinary Upload Error:",
            uploadError
          );

          return res.status(500).json({
            success: false,
            message: "Failed to upload reference image",
            error: uploadError.message
          });

        }

      }
    }


    // =========================
    // REQUEST NUMBER
    // =========================

    const requestNumber = await generateRequestNumber();


    // =========================
    // CREATE REQUEST
    // =========================

    const request = await CustomDesignRequest.create({

      requestNumber,

      customer: customerId,

      category,
      subCategory,
      subSubCategory,

      referenceImages,

      description: description.trim(),

      metalType: metalType || null,

      metalPurity: metalPurity || null,

      metalColor: metalColor || null,

      stonePreference: stonePreference || null,

      budget:
        budget !== undefined &&
          budget !== null &&
          budget !== ""
          ? Number(budget)
          : null,

      requiredDate:
        requiredDate || null,

      status: "NEW"

    });


    // =========================
    // POPULATE RESPONSE
    // =========================

    const populatedRequest =
      await CustomDesignRequest
        .findById(request._id)
        .populate("category", "name image")
        .populate("subCategory", "name image")
        .populate("subSubCategory", "name image");


    // =========================
    // SUCCESS RESPONSE
    // =========================

    return res.status(201).json({

      success: true,

      message:
        "Custom design request submitted successfully. Our team will contact you shortly.",

      data: populatedRequest

    });


  } catch (error) {

    console.error(
      "Create Custom Design Request Error:",
      error
    );

    return res.status(500).json({

      success: false,

      message: "Failed to create custom design request",

      error: error.message

    });

  }
};


exports.getMyCustomDesignRequests = async (req, res) => {
  try {
    const customerId = req.user?.userId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required"
      });
    }

    const requests = await CustomDesignRequest.find({
      customer: customerId
    })
      .populate("category", "name image")
      .populate("subCategory", "name image")
      .populate("subSubCategory", "name image")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });

  } catch (error) {
    console.error("Get My Custom Design Requests Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch custom design requests",
      error: error.message
    });
  }
};


// ==========================================
// GET MY CUSTOM DESIGN REQUEST BY ID
// ==========================================

exports.getMyCustomDesignRequestById = async (req, res) => {
  try {

    const { id } = req.params;

    console.log("REQUEST ID:", id);
    console.log("REQ.USER:", req.user);


    // Get user id from token
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.userId;


    console.log("USER ID FROM TOKEN:", userId);


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token"
      });
    }


    // ==========================================
    // FIND REQUEST
    // ==========================================

    const request =
      await CustomDesignRequest
        .findOne({
          _id: id,
          customer: userId
        })
        .populate("customer", "name email phone")
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("subSubCategory", "name");


    console.log(
      "FOUND REQUEST:",
      request
    );


    if (!request) {

      return res.status(404).json({
        success: false,
        message: "Custom design request not found"
      });
    }


    return res.status(200).json({
      success: true,
      message: "Custom design request fetched successfully",
      data: request
    });

  } catch (error) {

    console.error(
      "GET MY CUSTOM DESIGN REQUEST BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch custom design request",
      error: error.message
    });
  }
};


exports.cancelMyCustomDesignRequest = async (req, res) => {
  try {
    const customerId = req.user?.id || req.user?._id;
    const { id } = req.params;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required"
      });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID"
      });
    }

    const request = await CustomDesignRequest.findOne({
      _id: id,
      customer: customerId
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found"
      });
    }

    if (!["NEW", "CONTACTED"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message:
          "This request cannot be cancelled at the current stage"
      });
    }

    request.status = "CANCELLED";

    await request.save();

    return res.status(200).json({
      success: true,
      message: "Custom design request cancelled successfully",
      data: request
    });

  } catch (error) {
    console.error("Cancel Custom Design Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel custom design request",
      error: error.message
    });
  }
};


exports.getAllCustomDesignRequests = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      status,
      search
    } = req.query;

    page = Math.max(Number(page), 1);
    limit = Math.min(Math.max(Number(limit), 1), 100);

    const skip = (page - 1) * limit;

    const filter = {};

    if (status && status !== "ALL") {
      filter.status = status;
    }

    // Search request number
    if (search && search.trim()) {
      filter.requestNumber = {
        $regex: search.trim(),
        $options: "i"
      };
    }

    const [requests, total] = await Promise.all([
      CustomDesignRequest.find(filter)
        .populate("customer")
        .populate("category", "name image")
        .populate("subCategory", "name image")
        .populate("subSubCategory", "name image")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      CustomDesignRequest.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Get All Custom Design Requests Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch custom design requests",
      error: error.message
    });
  }
};



exports.getCustomDesignRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID"
      });
    }

    const request = await CustomDesignRequest.findById(id)
      .populate(
        "customer",
        "firstName lastName fullName mobile alternateMobile email"
      )
      .populate("category", "name image")
      .populate("subCategory", "name image")
      .populate("subSubCategory", "name image");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error("Get Custom Design Request By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch custom design request",
      error: error.message
    });
  }
};


exports.updateCustomDesignRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID"
      });
    }

    const allowedStatuses = [
      "NEW",
      "CONTACTED",
      "DISCUSSION",
      "QUOTATION_SENT",
      "ACCEPTED",
      "ORDER_CREATED",
      "IN_PRODUCTION",
      "COMPLETED",
      "REJECTED",
      "CANCELLED"
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid custom design request status"
      });
    }

    const request = await CustomDesignRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found"
      });
    }

    request.status = status;

    await request.save();

    const updatedRequest =
      await CustomDesignRequest.findById(request._id)
        .populate(
          "customer",
          "firstName lastName fullName mobile email"
        )
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("subSubCategory", "name");

    return res.status(200).json({
      success: true,
      message: "Custom design request status updated successfully",
      data: updatedRequest
    });

  } catch (error) {
    console.error("Update Custom Design Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update request status",
      error: error.message
    });
  }
};


exports.updateCustomDesignRequestNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID"
      });
    }

    const request = await CustomDesignRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found"
      });
    }

    request.adminNotes = adminNotes?.trim() || null;

    await request.save();

    return res.status(200).json({
      success: true,
      message: "Admin notes updated successfully",
      data: request
    });

  } catch (error) {
    console.error("Update Custom Design Notes Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update admin notes",
      error: error.message
    });
  }
};


exports.deleteCustomDesignRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID"
      });
    }

    const request = await CustomDesignRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found"
      });
    }

    // Don't delete active business requests
    if (
      !["NEW", "REJECTED", "CANCELLED", "COMPLETED"].includes(
        request.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This request cannot be deleted at the current stage"
      });
    }

    await CustomDesignRequest.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Custom design request deleted successfully"
    });

  } catch (error) {
    console.error("Delete Custom Design Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete custom design request",
      error: error.message
    });
  }
};

// ==========================================
// UPDATE MY CUSTOM DESIGN REQUEST
// ==========================================

// ==========================================
// UPDATE MY CUSTOM DESIGN REQUEST
// ==========================================
// =====================================================
// UPDATE MY CUSTOM DESIGN REQUEST
// =====================================================
// =====================================================
// UPDATE MY CUSTOM DESIGN REQUEST
// =====================================================

exports.updateMyCustomDesignRequest = async (req, res) => {

  try {

    const { id } = req.params;

    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.userId;


    console.log("=================================");
    console.log("UPDATE REQUEST ID:", id);
    console.log("USER ID:", userId);
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);
    console.log("=================================");


    if (!userId) {

      return res.status(401).json({
        success: false,
        message: "User ID not found in token"
      });
    }


    // =============================================
    // FIND USER REQUEST
    // =============================================

    const request =
      await CustomDesignRequest.findOne({
        _id: id,
        customer: userId
      });


    console.log(
      "REQUEST FOUND:",
      request
    );


    if (!request) {

      return res.status(404).json({
        success: false,
        message: "Custom design request not found"
      });
    }


    // =============================================
    // EXISTING IMAGES TO KEEP
    // =============================================

    let existingImages = [];


    if (req.body.existingImages) {

      try {

        existingImages =
          JSON.parse(
            req.body.existingImages
          );

      } catch (error) {

        return res.status(400).json({
          success: false,
          message: "Invalid existingImages data"
        });
      }
    }


    // =============================================
    // NEW FILES
    // =============================================

    const newFiles =
      req.files || [];


    // =============================================
    // MAX 5 IMAGES
    // =============================================

    if (
      existingImages.length +
      newFiles.length > 5
    ) {

      return res.status(400).json({
        success: false,
        message: "Maximum 5 images are allowed"
      });
    }


    // =============================================
    // FIND REMOVED IMAGES
    // =============================================

    const oldImages =
      request.referenceImages || [];


    const keptPublicIds =
      existingImages
        .map(
          image => image?.publicId
        )
        .filter(Boolean);


    const removedImages =
      oldImages.filter(
        image => {

          if (!image.publicId) {
            return false;
          }

          return !keptPublicIds.includes(
            image.publicId
          );
        }
      );


    // =============================================
    // DELETE REMOVED CLOUDINARY IMAGES
    // =============================================

    for (
      const image of removedImages
    ) {

      try {

        await cloudinary.uploader.destroy(
          image.publicId
        );

        console.log(
          "Deleted Cloudinary image:",
          image.publicId
        );

      } catch (error) {

        console.error(
          "Cloudinary delete error:",
          error
        );
      }
    }


    // =============================================
    // UPLOAD NEW IMAGES
    // =============================================

    const uploadedImages = [];


    for (
      const file of newFiles
    ) {

      const result =
        await new Promise(
          (resolve, reject) => {

            const uploadStream =
              cloudinary.uploader.upload_stream(
                {
                  folder:
                    "custom-design-requests",
                  resource_type:
                    "image"
                },

                (
                  error,
                  result
                ) => {

                  if (error) {
                    reject(error);
                  } else {
                    resolve(result);
                  }
                }
              );


            uploadStream.end(
              file.buffer
            );
          }
        );


      uploadedImages.push({
        url: result.secure_url,
        publicId: result.public_id
      });
    }


    // =============================================
    // FINAL IMAGE ARRAY
    // =============================================

    request.referenceImages = [
      ...existingImages,
      ...uploadedImages
    ];


    // =============================================
    // UPDATE OTHER FIELDS
    // =============================================

    if (
      req.body.category !== undefined
    ) {
      request.category =
        req.body.category;
    }


    if (
      req.body.subCategory !== undefined
    ) {
      request.subCategory =
        req.body.subCategory;
    }


    if (
      req.body.subSubCategory !== undefined
    ) {
      request.subSubCategory =
        req.body.subSubCategory;
    }


    if (
      req.body.description !== undefined
    ) {
      request.description =
        req.body.description;
    }


    if (
      req.body.metalType !== undefined
    ) {
      request.metalType =
        req.body.metalType || null;
    }


    if (
      req.body.metalPurity !== undefined
    ) {
      request.metalPurity =
        req.body.metalPurity || null;
    }


    if (
      req.body.metalColor !== undefined
    ) {
      request.metalColor =
        req.body.metalColor || null;
    }


    if (
      req.body.stonePreference !== undefined
    ) {
      request.stonePreference =
        req.body.stonePreference || null;
    }


    if (
      req.body.budget !== undefined
    ) {

      request.budget =
        req.body.budget === ""
          ? null
          : Number(req.body.budget);
    }


    if (
      req.body.requiredDate !== undefined
    ) {

      request.requiredDate =
        req.body.requiredDate || null;
    }


    // =============================================
    // SAVE
    // =============================================

    const updatedRequest =
      await request.save();


    // =============================================
    // POPULATE
    // =============================================

    await updatedRequest.populate([
      {
        path: "customer",
        select: "name email phone"
      },
      {
        path: "category",
        select: "name"
      },
      {
        path: "subCategory",
        select: "name"
      },
      {
        path: "subSubCategory",
        select: "name"
      }
    ]);


    // =============================================
    // RESPONSE
    // =============================================

    return res.status(200).json({

      success: true,

      message:
        "Custom design request updated successfully",

      data: updatedRequest

    });


  } catch (error) {

    console.error(
      "UPDATE CUSTOM DESIGN ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Failed to update custom design request",

      error:
        error.message

    });
  }
};
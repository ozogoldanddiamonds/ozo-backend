

const CustomDesignRequest = require("../models/custom-desing-request");
const cloudinary = require("../cloudinaryconfig");
const { Readable } = require("stream");

// CREATE CUSTOM DESIGN REQUEST
exports.createCustomDesignRequest = async (req, res) => {
  try {
    // 1. Get logged-in customer ID from JWT
    const customerId =
      req.user?.id ||
      req.user?._id ||
      req.user?.userId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found. Please login again."
      });
    }

    // 2. Upload reference images to Cloudinary
    const uploadedImages = [];
    const files = req.files || [];

    if (files.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 reference images are allowed."
      });
    }

    for (const file of files) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "custom-design-requests",
            resource_type: "image"
          },
          (error, result) => {
            if (error) {
              return reject(error);
            }

            if (!result) {
              return reject(new Error("Cloudinary upload failed."));
            }

            resolve(result);
          }
        );

        Readable.from(file.buffer).pipe(uploadStream);
      });

      uploadedImages.push({
        url: result.secure_url,
        publicId: result.public_id
      });
    }

    // 3. Create custom design request
    const customDesign = new CustomDesignRequest({
      requestNumber: `CDR-${Date.now()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`,

      customer: customerId,

      jewelleryType: req.body.jewelleryType,
      designType: req.body.designType,
      description: req.body.description,

      metalType: req.body.metalType,
      goldPurity: req.body.goldPurity || undefined,
      goldColor: req.body.goldColor || undefined,

      stoneType: req.body.stoneType,
      diamondType: req.body.diamondType || undefined,
      gemstoneType: req.body.gemstoneType || undefined,

      goldWeight: Number(req.body.goldWeight),
      requiredDate: req.body.requiredDate || null,
      quantity: Number(req.body.quantity),

      preferredContactMethod: req.body.preferredContactMethod,
      additionalNotes: req.body.additionalNotes || "",

      referenceImages: uploadedImages
    });

    // 4. Save to MongoDB
    await customDesign.save();

    // 5. Send response
    return res.status(201).json({
      success: true,
      message: "Custom design request created successfully.",
      data: customDesign
    });

  } catch (error) {
    console.error("Create Custom Design Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create custom design request."
    });
  }
};



// ===============================
// GET LOGGED-IN USER REQUESTS
// GET /api/custom-design-requests/my-requests
// ===============================
// GET ALL CUSTOM DESIGN REQUESTS - ADMIN
exports.getAllCustomDesignRequests = async (req, res) => {
  try {
    const requests = await CustomDesignRequest.find()
      .populate("customer", "name phone email profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });

  } catch (error) {
    console.error("Get All Custom Design Requests Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch custom design requests."
    });
  }
};


// ===============================
// GET SINGLE USER REQUEST
// GET /api/custom-design-requests/my-requests/:id
// ===============================
// GET ONE REQUEST FOR LOGGED-IN CUSTOMER
exports.getMyCustomDesignRequestById = async (req, res) => {
  try {
    const customerId =
      req.user?.userId ||
      req.user?.id ||
      req.user?._id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Please login again."
      });
    }

    const request = await CustomDesignRequest.findOne({
      _id: req.params.id,
      customer: customerId
    }).populate("customer", "name phone email profileImage");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error("Get Custom Design Request Error:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch custom design request."
    });
  }
};

// =========================================================================================================================

// GET LOGGED-IN CUSTOMER REQUESTS
exports.getMyCustomDesignRequests = async (req, res) => {
  try {
    const customerId =
      req.user?.userId ||
      req.user?.id ||
      req.user?._id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required."
      });
    }

    const requests = await CustomDesignRequest.find({
      customer: customerId
    })
      .populate("customer", "name phone email profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });

  } catch (error) {
    console.error(
      "Get My Custom Design Requests Error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your custom design requests.",
      error: error.message
    });
  }
};


// ==========================================
// GET MY CUSTOM DESIGN REQUEST BY ID
// ==========================================

// GET ONE REQUEST FOR LOGGED-IN CUSTOMER
exports.getMyCustomDesignRequestById = async (req, res) => {
  try {
    const customerId =
      req.user?.userId ||
      req.user?.id ||
      req.user?._id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Please login again."
      });
    }

    const request = await CustomDesignRequest.findOne({
      _id: req.params.id,
      customer: customerId
    }).populate("customer", "name phone email profileImage");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error("Get Custom Design Request Error:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch custom design request."
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


// GET ALL CUSTOM DESIGN REQUESTS - ADMIN
exports.getAllCustomDesignRequests = async (req, res) => {
  try {
    let { page = 1, limit = 10, status, search } = req.query;

    page = Math.max(Number(page) || 1, 1);
    limit = Math.min(Math.max(Number(limit) || 10, 1), 100);

    const skip = (page - 1) * limit;
    const filter = {};

    if (status && status !== "ALL") {
      filter.status = status;
    }

    if (search && search.trim()) {
      filter.requestNumber = {
        $regex: search.trim(),
        $options: "i"
      };
    }

    const [requests, total] = await Promise.all([
      CustomDesignRequest.find(filter)
        .populate("customer", "name phone email profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      CustomDesignRequest.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error(
      "Get All Custom Design Requests Error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch custom design requests.",
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
    const customerId =
      req.user?.id ||
      req.user?._id ||
      req.user?.userId;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const request = await CustomDesignRequest.findOne({
      _id: req.params.id,
      customer: customerId
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found."
      });
    }

    // Only allow editing requests that are still pending/reviewing.
    if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: "This request can no longer be edited."
      });
    }

    const allowedFields = [
      "jewelleryType",
      "designType",
      "description",
      "metalType",
      "goldPurity",
      "goldColor",
      "stoneType",
      "diamondType",
      "gemstoneType",
      "requiredDate",
      "preferredContactMethod",
      "additionalNotes"
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        request[field] = req.body[field];
      }
    }

    if (req.body.goldWeight !== undefined) {
      request.goldWeight = Number(req.body.goldWeight);
    }

    if (req.body.quantity !== undefined) {
      request.quantity = Number(req.body.quantity);
    }

    // Preserve existing images when no new images are uploaded.
    // If new files are supplied, upload them to Cloudinary first.
    if (req.files?.length) {
      const uploadedImages = [];

      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "custom-design-requests" },
            (error, uploadResult) => {
              if (error) return reject(error);
              resolve(uploadResult);
            }
          );

          stream.end(file.buffer);
        });

        uploadedImages.push({
          url: result.secure_url,
          publicId: result.public_id
        });
      }

      request.referenceImages = uploadedImages;
    }

    await request.save();

    return res.status(200).json({
      success: true,
      message: "Custom design request updated successfully.",
      data: request
    });
  } catch (error) {
    console.error("Update Custom Design Request Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update custom design request.",
      error: error.message
    });
  }
};
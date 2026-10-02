const mongoose = require("mongoose");
const CustomDesignRequest = require("../models/custom-desing-request");
const Category = require("../models/category");
const SubCategory = require("../models/sub-category");
const SubSubCategory = require("../models/sub-sub-category");


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
        const customerId = req.user?.id || req.user?._id;

        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required"
            });
        }

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
        // IMAGES
        // =========================

        const referenceImages = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                referenceImages.push({
                    url: file.path || file.secure_url || file.url,
                    publicId: file.filename || file.public_id || null
                });
            }
        }

        // Image optional or required?
        // For this flow we allow request without image.
        // Customer can explain their own design.

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

            requiredDate: requiredDate || null,

            status: "NEW"
        });

        // =========================
        // RESPONSE
        // =========================

        const populatedRequest =
            await CustomDesignRequest.findById(request._id)
                .populate("category", "name image")
                .populate("subCategory", "name image")
                .populate("subSubCategory", "name image");

        return res.status(201).json({
            success: true,
            message:
                "Custom design request submitted successfully. Our team will contact you shortly.",
            data: populatedRequest
        });

    } catch (error) {
        console.error("Create Custom Design Request Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create custom design request",
            error: error.message
        });
    }
};

exports.getMyCustomDesignRequests = async (req, res) => {
    try {
        const customerId = req.user?.id || req.user?._id;

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

exports.getMyCustomDesignRequestById = async (req, res) => {
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
        })
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
        console.error("Get My Custom Design Request Error:", error);

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
                .populate("customer", "firstName lastName fullName mobile email")
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
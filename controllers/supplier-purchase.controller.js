const SupplierPurchase = require("../models/supplier-purchase");
const Supplier = require("../models/supplier");
const cloudinary = require("../cloudinaryconfig");
const path = require("path");


// =====================================================
// CREATE SUPPLIER PURCHASE + UPLOAD DOCUMENTS
// =====================================================


// =====================================================
// CREATE SUPPLIER PURCHASE + DOCUMENT UPLOAD
// =====================================================

exports.createSupplierPurchase = async (req, res) => {

    try {

        const {
            supplier,
            invoiceNumber,
            invoiceDate,
            purchaseDate,
            subtotal,
            discount,
            tax,
            totalAmount,
            paymentStatus,
            notes,
            status
        } = req.body;


        // =========================================
        // VALIDATION
        // =========================================

        if (!supplier) {

            return res.status(400).json({
                success: false,
                message: "Supplier is required"
            });

        }


        if (!invoiceNumber) {

            return res.status(400).json({
                success: false,
                message: "Invoice number is required"
            });

        }


        if (!invoiceDate) {

            return res.status(400).json({
                success: false,
                message: "Invoice date is required"
            });

        }


        if (
            totalAmount === undefined ||
            totalAmount === null ||
            totalAmount === ""
        ) {

            return res.status(400).json({
                success: false,
                message: "Total amount is required"
            });

        }


        // =========================================
        // CHECK SUPPLIER
        // =========================================

        const existingSupplier =
            await Supplier.findById(supplier);


        if (!existingSupplier) {

            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });

        }


        // =========================================
        // DUPLICATE INVOICE
        // =========================================

        const existingPurchase =
            await SupplierPurchase.findOne({

                supplier: supplier,

                invoiceNumber:
                    invoiceNumber.trim()

            });


        if (existingPurchase) {

            return res.status(400).json({

                success: false,

                message:
                    "This invoice number already exists for this supplier"

            });

        }


        // =========================================
        // DOCUMENTS
        // =========================================

        const documents = [];


        if (
            req.files &&
            req.files.length > 0
        ) {


            for (
                const file of req.files
            ) {


               const result = await new Promise((resolve, reject) => {

  const resourceType =
    file.mimetype === 'application/pdf'
      ? 'raw'
      : 'image';

  const uploadStream =
    cloudinary.uploader.upload_stream(
      {
        folder: 'supplier-purchases',
        resource_type: resourceType
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


                documents.push({

                    url:
                        result.secure_url,

                    type:
                        "OTHER",

                    description:
                        file.originalname,

                    uploadedAt:
                        new Date()

                });

            }

        }


        // =========================================
        // CREATE PURCHASE
        // =========================================

        const purchase =
            await SupplierPurchase.create({

                supplier,

                invoiceNumber:
                    invoiceNumber.trim(),

                invoiceDate,

                purchaseDate:
                    purchaseDate ||
                    Date.now(),

                subtotal:
                    Number(subtotal) || 0,

                discount:
                    Number(discount) || 0,

                tax:
                    Number(tax) || 0,

                totalAmount:
                    Number(totalAmount),

                paymentStatus:
                    paymentStatus ||
                    "PENDING",

                notes:
                    notes?.trim() || "",

                documents,

                status:
                    status ||
                    "DRAFT"

            });


        // =========================================
        // POPULATE SUPPLIER
        // =========================================

        await purchase.populate(
            "supplier"
        );


        // =========================================
        // RESPONSE
        // =========================================

        return res.status(201).json({

            success: true,

            message:
                "Supplier purchase created successfully",

            data:
                purchase

        });

    }


    catch (error) {

        console.error(
            "Create Supplier Purchase Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// GET ALL SUPPLIER PURCHASES
// =====================================================

exports.getAllSupplierPurchases = async (req, res) => {

    try {

        const purchases =
            await SupplierPurchase
                .find()
                .populate(
                    "supplier",
                    "name companyName phone email gstNumber"
                )
                .sort({
                    purchaseDate: -1
                });


        return res.status(200).json({

            success: true,

            count:
                purchases.length,

            data:
                purchases

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// GET SUPPLIER PURCHASE BY ID
// =====================================================

exports.getSupplierPurchaseById = async (req, res) => {

    try {

        const { id } =
            req.params;


        const purchase =
            await SupplierPurchase
                .findById(id)
                .populate(
                    "supplier"
                );


        if (!purchase) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Supplier purchase fetched successfully",

            data:
                purchase

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};
// =====================================================
// GET ALL PURCHASES BY SUPPLIER
// =====================================================

exports.getSupplierPurchases = async (req, res) => {

    try {

        const { supplierId } =
            req.params;


        // ==========================
        // CHECK SUPPLIER
        // ==========================

        const supplier =
            await Supplier.findById(
                supplierId
            );

        if (!supplier) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier not found"

            });

        }


        // ==========================
        // GET PURCHASES
        // ==========================

        const purchases =
            await SupplierPurchase
                .find({
                    supplier:
                        supplierId
                })
                .populate(
                    "supplier",
                    "name companyName phone email gstNumber"
                )
                .sort({
                    purchaseDate: -1
                });


        return res.status(200).json({

            success: true,

            count:
                purchases.length,

            data:
                purchases

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// UPDATE SUPPLIER PURCHASE
// =====================================================

// =====================================================
// UPDATE SUPPLIER PURCHASE + UPLOAD NEW DOCUMENTS
// =====================================================


exports.updateSupplierPurchase = async (req, res) => {
  try {

    const {
      supplier,
      invoiceNumber,
      invoiceDate,
      purchaseDate,
      subtotal,
      discount,
      tax,
      totalAmount,
      paymentStatus,
      notes,
      status,
      existingDocuments
    } = req.body;


    // =====================================================
    // 1. FIND PURCHASE
    // =====================================================

    const purchase = await SupplierPurchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Supplier purchase not found"
      });
    }


    // =====================================================
    // 2. VALIDATION
    // =====================================================

    if (!supplier) {
      return res.status(400).json({
        success: false,
        message: "Supplier is required"
      });
    }

    if (!invoiceNumber || !invoiceNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required"
      });
    }

    if (!invoiceDate) {
      return res.status(400).json({
        success: false,
        message: "Invoice date is required"
      });
    }

    if (
      totalAmount === undefined ||
      totalAmount === null ||
      totalAmount === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Total amount is required"
      });
    }


    // =====================================================
    // 3. CHECK SUPPLIER
    // =====================================================

    const existingSupplier = await Supplier.findById(supplier);

    if (!existingSupplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }


    // =====================================================
    // 4. DUPLICATE INVOICE CHECK
    // =====================================================

    const duplicatePurchase =
      await SupplierPurchase.findOne({
        supplier: supplier,
        invoiceNumber: invoiceNumber.trim(),
        _id: {
          $ne: req.params.id
        }
      });

    if (duplicatePurchase) {
      return res.status(400).json({
        success: false,
        message:
          "This invoice number already exists for this supplier"
      });
    }


    // =====================================================
    // 5. EXISTING DOCUMENTS
    // =====================================================

    let finalDocuments = [];

    if (existingDocuments) {

      try {

        finalDocuments = JSON.parse(existingDocuments);

        if (!Array.isArray(finalDocuments)) {
          finalDocuments = [];
        }

      } catch (error) {

        return res.status(400).json({
          success: false,
          message: "Invalid existing documents format"
        });

      }
    }


    // =====================================================
    // 6. UPLOAD NEW DOCUMENTS TO CLOUDINARY
    // =====================================================

    if (req.files && req.files.length > 0) {

      console.log(
        "Files received:",
        req.files.length
      );

      for (const file of req.files) {

        console.log(
          "Uploading:",
          file.originalname,
          file.mimetype
        );


        // -------------------------------------------------
        // RESOURCE TYPE
        // -------------------------------------------------
        // PDF and images -> image resource
        // -------------------------------------------------

        const resourceType = "image";


        // -------------------------------------------------
        // GET FILE EXTENSION
        // -------------------------------------------------

        const extension =
          path.extname(file.originalname);


        // -------------------------------------------------
        // GET FILE NAME WITHOUT EXTENSION
        // -------------------------------------------------

        let fileName =
          path.basename(
            file.originalname,
            extension
          );


        // -------------------------------------------------
        // REMOVE SPECIAL CHARACTERS
        // -------------------------------------------------

        fileName = fileName
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");


        // -------------------------------------------------
        // DEFAULT FILE NAME
        // -------------------------------------------------

        if (!fileName) {
          fileName = "document";
        }


        // -------------------------------------------------
        // UNIQUE PUBLIC ID
        // -------------------------------------------------

        const publicId =
          `${fileName}-${Date.now()}`;


        console.log(
          "Cloudinary public_id:",
          publicId
        );

        console.log(
          "Cloudinary resource_type:",
          resourceType
        );


        // =================================================
        // CLOUDINARY UPLOAD
        // =================================================

        const result =
          await new Promise((resolve, reject) => {

            const uploadOptions = {

              folder: "supplier-purchases",

              public_id: publicId,

              resource_type: resourceType

            };


            const uploadStream =
              cloudinary.uploader.upload_stream(

                uploadOptions,

                (error, result) => {

                  if (error) {

                    console.error(
                      "Cloudinary Upload Error:",
                      error
                    );

                    reject(error);

                  } else {

                    resolve(result);

                  }

                }

              );


            uploadStream.end(file.buffer);

          });


        // =================================================
        // CLOUDINARY SUCCESS
        // =================================================

        console.log(
          "Cloudinary upload successful"
        );

        console.log(
          "Cloudinary URL:",
          result.secure_url
        );


        // =================================================
        // ADD DOCUMENT
        // =================================================

        finalDocuments.push({

          url: result.secure_url,

          type: "OTHER",

          description: file.originalname,

          uploadedAt: new Date()

        });

      }
    }


    // =====================================================
    // 7. MAXIMUM DOCUMENT CHECK
    // =====================================================

    if (finalDocuments.length > 10) {

      return res.status(400).json({
        success: false,
        message: "Maximum 10 documents are allowed"
      });

    }


    // =====================================================
    // 8. UPDATE PURCHASE FIELDS
    // =====================================================

    purchase.supplier =
      supplier;

    purchase.invoiceNumber =
      invoiceNumber.trim();

    purchase.invoiceDate =
      invoiceDate;

    purchase.purchaseDate =
      purchaseDate ||
      purchase.purchaseDate ||
      Date.now();

    purchase.subtotal =
      Number(subtotal) || 0;

    purchase.discount =
      Number(discount) || 0;

    purchase.tax =
      Number(tax) || 0;

    purchase.totalAmount =
      Number(totalAmount);

    purchase.paymentStatus =
      paymentStatus || "PENDING";

    purchase.notes =
      notes?.trim() || "";

    purchase.status =
      status || "DRAFT";


    // =====================================================
    // 9. UPDATE DOCUMENTS
    // =====================================================

    purchase.documents =
      finalDocuments;


    // =====================================================
    // 10. SAVE
    // =====================================================

    await purchase.save();


    // =====================================================
    // 11. POPULATE SUPPLIER
    // =====================================================

    await purchase.populate("supplier");


    // =====================================================
    // 12. SUCCESS RESPONSE
    // =====================================================

    return res.status(200).json({

      success: true,

      message:
        "Supplier purchase updated successfully",

      data: purchase

    });


  } catch (error) {

    console.error(
      "Update Supplier Purchase Error:",
      error
    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }
};
// =====================================================
// ADD DOCUMENT TO SUPPLIER PURCHASE
// =====================================================

exports.addPurchaseDocument = async (req, res) => {

    try {

        const { id } =
            req.params;

        const {
            type,
            description
        } = req.body;


        // ==========================
        // FILE CHECK
        // ==========================

        if (!req.file) {

            return res.status(400).json({

                success: false,

                message:
                    "Document file is required"

            });

        }


        // ==========================
        // PURCHASE CHECK
        // ==========================

        const purchase =
            await SupplierPurchase.findById(
                id
            );

        if (!purchase) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        // ==========================
        // CLOUDINARY
        // ==========================

        const result =
            await new Promise(
                (resolve, reject) => {

                    cloudinary
                        .uploader
                        .upload_stream(
                            {
                                folder:
                                    "supplier-purchases",

                                resource_type:
                                    "auto"
                            },

                            (
                                error,
                                result
                            ) => {

                                if (error) {

                                    reject(
                                        error
                                    );

                                }
                                else {

                                    resolve(
                                        result
                                    );

                                }

                            }
                        )
                        .end(
                            req.file.buffer
                        );

                }
            );


        // ==========================
        // ADD DOCUMENT
        // ==========================

        purchase.documents.push({

            url:
                result.secure_url,

            type:
                type || "OTHER",

            description:
                description || "",

            uploadedAt:
                new Date()

        });


        await purchase.save();


        return res.status(200).json({

            success: true,

            message:
                "Purchase document added successfully",

            data:
                purchase

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// DELETE PURCHASE DOCUMENT
// =====================================================

exports.deletePurchaseDocument = async (
    req,
    res
) => {

    try {

        const {
            id,
            documentId
        } = req.params;


        const purchase =
            await SupplierPurchase.findById(
                id
            );

        if (!purchase) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        const document =
            purchase.documents.id(
                documentId
            );

        if (!document) {

            return res.status(404).json({

                success: false,

                message:
                    "Purchase document not found"

            });

        }


        document.deleteOne();

        await purchase.save();


        return res.status(200).json({

            success: true,

            message:
                "Purchase document deleted successfully",

            data:
                purchase

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// UPDATE PURCHASE PAYMENT STATUS
// =====================================================

exports.updatePurchasePaymentStatus = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;

        const {
            paymentStatus
        } = req.body;


        // ==========================
        // VALIDATION
        // ==========================

        const validStatuses = [

            "PENDING",

            "PARTIAL",

            "PAID"

        ];


        if (
            !validStatuses.includes(
                paymentStatus
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid payment status"

            });

        }


        // ==========================
        // UPDATE
        // ==========================

        const purchase =
            await SupplierPurchase
                .findByIdAndUpdate(

                    id,

                    {
                        paymentStatus
                    },

                    {
                        new: true
                    }

                )
                .populate(
                    "supplier"
                );


        if (!purchase) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Payment status updated successfully",

            data:
                purchase

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// UPDATE PURCHASE STATUS
// =====================================================

exports.updateSupplierPurchaseStatus = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;

        const {
            status
        } = req.body;


        const validStatuses = [

            "DRAFT",

            "RECEIVED",

            "CANCELLED"

        ];


        if (
            !validStatuses.includes(
                status
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid purchase status"

            });

        }


        const purchase =
            await SupplierPurchase
                .findByIdAndUpdate(

                    id,

                    {
                        status
                    },

                    {
                        new: true
                    }

                )
                .populate(
                    "supplier"
                );


        if (!purchase) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Purchase status updated successfully",

            data:
                purchase

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// DELETE SUPPLIER PURCHASE
// =====================================================

exports.deleteSupplierPurchase = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        const purchase =
            await SupplierPurchase.findById(
                id
            );

        if (!purchase) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        // ==========================
        // RECEIVED PURCHASE DELETE
        // BLOCK
        // ==========================

        if (
            purchase.status === "RECEIVED"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Received purchase cannot be deleted. Cancel the purchase instead."

            });

        }


        await SupplierPurchase.findByIdAndDelete(
            id
        );


        return res.status(200).json({

            success: true,

            message:
                "Supplier purchase deleted successfully"

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};
const SupplierPurchase = require("../models/supplier-purchase");
const Supplier = require("../models/supplier");
const cloudinary = require("../cloudinaryconfig");


// =====================================================
// CREATE SUPPLIER PURCHASE + UPLOAD DOCUMENTS
// =====================================================

exports.createSupplierPurchase = async (req, res) => {

    try {

        const { supplier, invoiceNumber, invoiceDate, purchaseDate, subtotal, discount, tax, totalAmount, paymentStatus, notes, status } = req.body;

        // ==========================
        // VALIDATION
        // ==========================

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


        // ==========================
        // CHECK SUPPLIER
        // ==========================

        const existingSupplier =
            await Supplier.findById(supplier);

        if (!existingSupplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }


        // ==========================
        // DUPLICATE INVOICE
        // ==========================

        const existingPurchase =
            await SupplierPurchase.findOne({
                supplier,
                invoiceNumber: invoiceNumber.trim()
            });

        if (existingPurchase) {
            return res.status(400).json({
                success: false,
                message:
                    "This invoice number already exists for this supplier"
            });
        }


        // =================================================
        // DOCUMENTS
        // =================================================

        const documents = [];


        if (req.files && req.files.length > 0) {

            for (const file of req.files) {

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
                                            reject(error);
                                        }
                                        else {
                                            resolve(result);
                                        }

                                    }
                                )
                                .end(file.buffer);

                        }
                    );


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


        // =================================================
        // CREATE PURCHASE
        // =================================================

        const purchase =
            await SupplierPurchase.create({

                supplier,

                invoiceNumber:
                    invoiceNumber.trim(),

                invoiceDate,

                purchaseDate:
                    purchaseDate || Date.now(),

                subtotal:
                    Number(subtotal) || 0,

                discount:
                    Number(discount) || 0,

                tax:
                    Number(tax) || 0,

                totalAmount:
                    Number(totalAmount),

                paymentStatus:
                    paymentStatus || "PENDING",

                notes:
                    notes?.trim() || "",

                documents,

                status:
                    status || "DRAFT"

            });


        // ==========================
        // POPULATE SUPPLIER
        // ==========================

        await purchase.populate(
            "supplier"
        );


        return res.status(201).json({

            success: true,

            message:
                "Supplier purchase created successfully",

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
            status
        } = req.body;


        // ==========================
        // PURCHASE ID
        // ==========================

        const purchaseId = req.params.id;

        if (!purchaseId) {

            return res.status(400).json({
                success: false,
                message: "Purchase ID is required"
            });

        }


        // ==========================
        // CHECK PURCHASE
        // ==========================

        const existingPurchase =
            await SupplierPurchase.findById(purchaseId);

        if (!existingPurchase) {

            return res.status(404).json({
                success: false,
                message: "Supplier purchase not found"
            });

        }


        // ==========================
        // VALIDATION
        // ==========================

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


        // ==========================
        // CHECK SUPPLIER
        // ==========================

        const existingSupplier =
            await Supplier.findById(supplier);

        if (!existingSupplier) {

            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });

        }


        // ==========================
        // DUPLICATE INVOICE
        // ==========================

        const duplicateInvoice =
            await SupplierPurchase.findOne({

                supplier,

                invoiceNumber:
                    invoiceNumber.trim(),

                _id: {
                    $ne: purchaseId
                }

            });


        if (duplicateInvoice) {

            return res.status(400).json({

                success: false,

                message:
                    "This invoice number already exists for this supplier"

            });

        }


        // =================================================
        // DOCUMENTS
        // =================================================

        // Existing documents ni retain chestham
        const documents =
            existingPurchase.documents
                ? [...existingPurchase.documents]
                : [];


        // =================================================
        // UPLOAD NEW DOCUMENTS
        // =================================================

        if (
            req.files &&
            req.files.length > 0
        ) {

            for (const file of req.files) {

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
                                            reject(error);
                                        }
                                        else {
                                            resolve(result);
                                        }

                                    }
                                )
                                .end(file.buffer);

                        }
                    );


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


        // =================================================
        // UPDATE PURCHASE
        // =================================================

        existingPurchase.supplier =
            supplier;

        existingPurchase.invoiceNumber =
            invoiceNumber.trim();

        existingPurchase.invoiceDate =
            invoiceDate;

        existingPurchase.purchaseDate =
            purchaseDate ||
            existingPurchase.purchaseDate ||
            Date.now();

        existingPurchase.subtotal =
            Number(subtotal) || 0;

        existingPurchase.discount =
            Number(discount) || 0;

        existingPurchase.tax =
            Number(tax) || 0;

        existingPurchase.totalAmount =
            Number(totalAmount);

        existingPurchase.paymentStatus =
            paymentStatus ||
            existingPurchase.paymentStatus ||
            "PENDING";

        existingPurchase.notes =
            notes?.trim() || "";

        existingPurchase.documents =
            documents;

        existingPurchase.status =
            status ||
            existingPurchase.status ||
            "DRAFT";


        await existingPurchase.save();


        // ==========================
        // POPULATE SUPPLIER
        // ==========================

        await existingPurchase.populate(
            "supplier"
        );


        // ==========================
        // RESPONSE
        // ==========================

        return res.status(200).json({

            success: true,

            message:
                "Supplier purchase updated successfully",

            data:
                existingPurchase

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
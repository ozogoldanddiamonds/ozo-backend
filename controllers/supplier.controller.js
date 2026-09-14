const Supplier = require("../models/supplier");

// =====================================================
// CREATE SUPPLIER
// =====================================================

exports.createSupplier = async (req, res) => {

    try {

        const {
            name,
            companyName,
            phone,
            email,
            gstNumber,
            address,
            notes,
            isActive
        } = req.body;

        // ==========================
        // VALIDATION
        // ==========================

        if (!name) {

            return res.status(400).json({
                success: false,
                message: "Supplier name is required"
            });

        }

        if (!phone) {

            return res.status(400).json({
                success: false,
                message: "Supplier phone is required"
            });

        }

        // ==========================
        // DUPLICATE CHECK
        // ==========================

        const duplicateQuery = {
            $or: [
                {
                    phone: phone.trim()
                }
            ]
        };

        if (gstNumber?.trim()) {

            duplicateQuery.$or.push({
                gstNumber: gstNumber.trim()
            });

        }

        const existingSupplier =
            await Supplier.findOne(duplicateQuery);

        if (existingSupplier) {

            return res.status(400).json({
                success: false,
                message:
                    "Supplier with this phone or GST number already exists"
            });

        }

        // ==========================
        // CREATE
        // ==========================

        const supplier =
            await Supplier.create({

                name: name.trim(),

                companyName:
                    companyName?.trim() || "",

                phone:
                    phone.trim(),

                email:
                    email?.trim() || "",

                gstNumber:
                    gstNumber?.trim() || "",

                address:
                    address || {},

                notes:
                    notes?.trim() || "",

                isActive:
                    isActive !== undefined
                        ? isActive
                        : true

            });

        return res.status(201).json({

            success: true,

            message:
                "Supplier created successfully",

            data: supplier

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =====================================================
// GET ALL SUPPLIERS
// =====================================================

exports.getAllSuppliers = async (req, res) => {

    try {

        const suppliers =
            await Supplier
                .find()
                .sort({
                    createdAt: -1
                });

        return res.status(200).json({

            success: true,

            count: suppliers.length,

            data: suppliers

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =====================================================
// GET ACTIVE SUPPLIERS
// Useful for Purchase Create screen
// =====================================================

exports.getActiveSuppliers = async (req, res) => {

    try {

        const suppliers =
            await Supplier
                .find({
                    isActive: true
                })
                .sort({
                    name: 1
                });

        return res.status(200).json({

            success: true,

            count: suppliers.length,

            data: suppliers

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =====================================================
// GET SUPPLIER BY ID
// =====================================================

exports.getSupplierById = async (req, res) => {

    try {

        const { id } = req.params;

        const supplier =
            await Supplier.findById(id);

        if (!supplier) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier not found"

            });

        }

        return res.status(200).json({

            success: true,

            data: supplier

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =====================================================
// UPDATE SUPPLIER
// =====================================================

exports.updateSupplier = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            name,
            companyName,
            phone,
            email,
            gstNumber,
            address,
            notes,
            isActive
        } = req.body;

        // ==========================
        // CHECK SUPPLIER
        // ==========================

        const supplier =
            await Supplier.findById(id);

        if (!supplier) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier not found"

            });

        }

        // ==========================
        // DUPLICATE CHECK
        // Exclude current supplier
        // ==========================

        if (phone || gstNumber) {

            const duplicateQuery = {

                _id: {
                    $ne: id
                },

                $or: []

            };

            if (phone?.trim()) {

                duplicateQuery.$or.push({
                    phone: phone.trim()
                });

            }

            if (gstNumber?.trim()) {

                duplicateQuery.$or.push({
                    gstNumber: gstNumber.trim()
                });

            }

            if (duplicateQuery.$or.length) {

                const duplicate =
                    await Supplier.findOne(
                        duplicateQuery
                    );

                if (duplicate) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Another supplier already exists with this phone or GST number"

                    });

                }

            }

        }

        // ==========================
        // UPDATE
        // ==========================

        supplier.name =
            name?.trim() || supplier.name;

        supplier.companyName =
            companyName?.trim() || "";

        supplier.phone =
            phone?.trim() || supplier.phone;

        supplier.email =
            email?.trim() || "";

        supplier.gstNumber =
            gstNumber?.trim() || "";

        supplier.address =
            address || supplier.address;

        supplier.notes =
            notes?.trim() || "";

        if (isActive !== undefined) {

            supplier.isActive =
                isActive;

        }

        await supplier.save();

        return res.status(200).json({

            success: true,

            message:
                "Supplier updated successfully",

            data: supplier

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =====================================================
// DELETE SUPPLIER
// =====================================================

exports.deleteSupplier = async (req, res) => {

    try {

        const { id } = req.params;

        const supplier =
            await Supplier.findById(id);

        if (!supplier) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier not found"

            });

        }

        await Supplier.findByIdAndDelete(id);

        return res.status(200).json({

            success: true,

            message:
                "Supplier deleted successfully"

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =====================================================
// ACTIVATE / DEACTIVATE SUPPLIER
// =====================================================

exports.updateSupplierStatus = async (req, res) => {

    try {

        const { id } = req.params;

        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {

            return res.status(400).json({

                success: false,

                message:
                    "isActive must be true or false"

            });

        }

        const supplier =
            await Supplier.findByIdAndUpdate(

                id,

                {
                    isActive
                },

                {
                    new: true
                }

            );

        if (!supplier) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier not found"

            });

        }

        return res.status(200).json({

            success: true,

            message:
                isActive
                    ? "Supplier activated successfully"
                    : "Supplier deactivated successfully",

            data: supplier

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};
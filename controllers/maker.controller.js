const mongoose = require("mongoose");

const Maker = require("../models/maker");


// =====================================================
// CREATE MAKER
// POST /create-maker
// =====================================================

exports.createMaker = async (req, res) => {

    try {

        const {
            name,
            phone,
            email,
            address,
            specialization,
            notes,
            isActive
        } = req.body;


        // =============================================
        // BASIC VALIDATION
        // =============================================

        if (!name || !name.trim()) {

            return res.status(400).json({

                success: false,

                message: "Maker Name is required"

            });

        }


        if (!phone || !phone.trim()) {

            return res.status(400).json({

                success: false,

                message: "Maker Phone Number is required"

            });

        }


        // =============================================
        // PHONE VALIDATION
        // =============================================

        const phoneRegex = /^[0-9]{10}$/;

        if (!phoneRegex.test(phone.trim())) {

            return res.status(400).json({

                success: false,

                message:
                    "Maker Phone Number must be exactly 10 digits"

            });

        }


        // =============================================
        // EMAIL VALIDATION
        // =============================================

        if (email && email.trim()) {

            const emailRegex =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email.trim())) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please enter a valid email address"

                });

            }

        }


        // =============================================
        // PINCODE VALIDATION
        // =============================================

        if (
            address?.pincode &&
            String(address.pincode).trim()
        ) {

            const pincodeRegex =
                /^[0-9]{6}$/;

            if (
                !pincodeRegex.test(
                    String(address.pincode).trim()
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Pincode must be exactly 6 digits"

                });

            }

        }


        // =============================================
        // DUPLICATE MAKER CHECK
        // =============================================

        const existingMaker =
            await Maker.findOne({

                $or: [

                    {
                        name: {
                            $regex:
                                `^${name.trim()}$`,
                            $options: "i"
                        }
                    },

                    {
                        phone:
                            phone.trim()
                    }

                ]

            });


        if (existingMaker) {

            if (
                existingMaker.phone ===
                phone.trim()
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Maker Phone Number already exists"

                });

            }


            return res.status(409).json({

                success: false,

                message:
                    "Maker Name already exists"

            });

        }


        // =============================================
        // CREATE MAKER
        // =============================================

        const maker =
            await Maker.create({

                name:
                    name.trim(),

                phone:
                    phone.trim(),

                email:
                    email?.trim() || "",

                address: {

                    addressLine1:
                        address?.addressLine1?.trim() || "",

                    addressLine2:
                        address?.addressLine2?.trim() || "",

                    city:
                        address?.city?.trim() || "",

                    state:
                        address?.state?.trim() || "",

                    pincode:
                        address?.pincode?.trim() || "",

                    country:
                        address?.country?.trim() || "India"

                },

                specialization:
                    specialization?.trim() || "",

                notes:
                    notes?.trim() || "",

                isActive:
                    typeof isActive === "boolean"
                        ? isActive
                        : true

            });


        // =============================================
        // SUCCESS
        // =============================================

        return res.status(201).json({

            success: true,

            message:
                "Maker created successfully",

            data:
                maker

        });

    }

    catch (error) {

        console.log(
            "Create Maker Error:",
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
// GET ALL MAKERS
// GET /get-all-makers
// =====================================================

exports.getAllMakers = async (req, res) => {

    try {

        const makers =
            await Maker.find()

                .sort({
                    createdAt: -1
                });


        return res.status(200).json({

            success: true,

            count:
                makers.length,

            data:
                makers

        });

    }

    catch (error) {

        console.log(
            "Get All Makers Error:",
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
// GET ACTIVE MAKERS
// GET /get-active-makers
// =====================================================

exports.getActiveMakers = async (req, res) => {

    try {

        const makers =
            await Maker.find({

                isActive: true

            })

                .sort({
                    name: 1
                });


        return res.status(200).json({

            success: true,

            count:
                makers.length,

            data:
                makers

        });

    }

    catch (error) {

        console.log(
            "Get Active Makers Error:",
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
// GET MAKER BY ID
// GET /get-maker/:id
// =====================================================

exports.getMakerById = async (req, res) => {

    try {

        const { id } = req.params;


        // =============================================
        // VALIDATE ID
        // =============================================

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Maker ID"

            });

        }


        // =============================================
        // FIND MAKER
        // =============================================

        const maker =
            await Maker.findById(id);


        if (!maker) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker not found"

            });

        }


        // =============================================
        // SUCCESS
        // =============================================

        return res.status(200).json({

            success: true,

            data:
                maker

        });

    }


    catch (error) {

        console.log(
            "Get Maker By ID Error:",
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
// UPDATE MAKER
// PUT /update-maker/:id
// =====================================================

exports.updateMaker = async (req, res) => {

    try {

        const {
            id
        } = req.params;


        // =============================================
        // VALIDATE ID
        // =============================================

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Maker ID"

            });

        }


        const existingMaker =
            await Maker.findById(id);


        if (!existingMaker) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker not found"

            });

        }


        const {
            name,
            phone,
            email,
            address,
            specialization,
            notes,
            isActive
        } = req.body;


        // =============================================
        // REQUIRED VALIDATION
        // =============================================

        if (
            name !== undefined &&
            !String(name).trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Maker Name is required"

            });

        }


        if (
            phone !== undefined &&
            !String(phone).trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Maker Phone Number is required"

            });

        }


        // =============================================
        // PHONE VALIDATION
        // =============================================

        if (
            phone !== undefined
        ) {

            const cleanPhone =
                String(phone).trim();


            const phoneRegex =
                /^[0-9]{10}$/;


            if (
                !phoneRegex.test(
                    cleanPhone
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Maker Phone Number must be exactly 10 digits"

                });

            }


            // =========================================
            // DUPLICATE PHONE
            // =========================================

            const duplicatePhone =
                await Maker.findOne({

                    phone: cleanPhone,

                    _id: {
                        $ne: id
                    }

                });


            if (duplicatePhone) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Maker Phone Number already exists"

                });

            }

        }


        // =============================================
        // EMAIL VALIDATION
        // =============================================

        if (
            email !== undefined &&
            String(email).trim()
        ) {

            const emailRegex =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (
                !emailRegex.test(
                    String(email).trim()
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please enter a valid email address"

                });

            }

        }


        // =============================================
        // PINCODE VALIDATION
        // =============================================

        const pincode =
            address?.pincode !== undefined

                ? String(
                    address.pincode
                ).trim()

                : existingMaker
                    .address
                    ?.pincode || "";


        if (pincode) {

            const pincodeRegex =
                /^[0-9]{6}$/;


            if (
                !pincodeRegex.test(
                    pincode
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Pincode must be exactly 6 digits"

                });

            }

        }


        // =============================================
        // BUILD UPDATE DATA
        // =============================================

        const updateData = {};


        if (name !== undefined) {

            updateData.name =
                String(name).trim();

        }


        if (phone !== undefined) {

            updateData.phone =
                String(phone).trim();

        }


        if (email !== undefined) {

            updateData.email =
                String(email).trim();

        }


        if (specialization !== undefined) {

            updateData.specialization =
                String(
                    specialization
                ).trim();

        }


        if (notes !== undefined) {

            updateData.notes =
                String(notes).trim();

        }


        if (typeof isActive === "boolean") {

            updateData.isActive =
                isActive;

        }


        // =============================================
        // ADDRESS
        // =============================================

        if (address !== undefined) {

            updateData.address = {

                addressLine1:
                    address.addressLine1 !== undefined
                        ? String(
                            address.addressLine1
                        ).trim()
                        : existingMaker.address?.addressLine1 || "",

                addressLine2:
                    address.addressLine2 !== undefined
                        ? String(
                            address.addressLine2
                        ).trim()
                        : existingMaker.address?.addressLine2 || "",

                city:
                    address.city !== undefined
                        ? String(
                            address.city
                        ).trim()
                        : existingMaker.address?.city || "",

                state:
                    address.state !== undefined
                        ? String(
                            address.state
                        ).trim()
                        : existingMaker.address?.state || "",

                pincode,

                country:
                    address.country !== undefined
                        ? String(
                            address.country
                        ).trim()
                        : existingMaker.address?.country || "India"

            };

        }


        // =============================================
        // UPDATE
        // =============================================

        const maker =
            await Maker.findByIdAndUpdate(

                id,

                {
                    $set: updateData
                },

                {
                    new: true,

                    runValidators: true

                }

            );


        return res.status(200).json({

            success: true,

            message:
                "Maker updated successfully",

            data:
                maker

        });

    }

    catch (error) {

        console.log(
            "Update Maker Error:",
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
// DELETE MAKER
// DELETE /delete-maker/:id
// =====================================================

exports.deleteMaker = async (req, res) => {

    try {

        const {
            id
        } = req.params;


        // =============================================
        // VALIDATE ID
        // =============================================

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Maker ID"

            });

        }


        const maker =
            await Maker.findById(id);


        if (!maker) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker not found"

            });

        }


        // =============================================
        // DELETE
        // =============================================

        await Maker.findByIdAndDelete(id);


        return res.status(200).json({

            success: true,

            message:
                "Maker deleted successfully",

            data: {

                id

            }

        });

    }

    catch (error) {

        console.log(
            "Delete Maker Error:",
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
// UPDATE MAKER STATUS
// PUT /update-maker-status/:id
// =====================================================

exports.updateMakerStatus = async (req, res) => {

    try {

        const {
            id
        } = req.params;


        const {
            isActive
        } = req.body;


        // =============================================
        // VALIDATE ID
        // =============================================

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Maker ID"

            });

        }


        // =============================================
        // STATUS VALIDATION
        // =============================================

        if (
            typeof isActive !== "boolean"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "isActive must be true or false"

            });

        }


        // =============================================
        // FIND MAKER
        // =============================================

        const maker =
            await Maker.findById(id);


        if (!maker) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker not found"

            });

        }


        // =============================================
        // UPDATE STATUS
        // =============================================

        maker.isActive =
            isActive;


        await maker.save();


        return res.status(200).json({

            success: true,

            message:
                isActive
                    ? "Maker activated successfully"
                    : "Maker deactivated successfully",

            data: {

                id:
                    maker._id,

                isActive:
                    maker.isActive

            }

        });

    }

    catch (error) {

        console.log(
            "Update Maker Status Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};
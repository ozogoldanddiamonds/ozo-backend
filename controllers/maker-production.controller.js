const mongoose = require("mongoose");

const MakerProduction = require("../models/maker-production");

const Maker = require("../models/maker");


// =====================================================
// CREATE MAKER PRODUCTION
// POST /create-maker-production
// =====================================================

exports.createMakerProduction = async (req, res) => {

    try {

        const {
            maker,
            productionNumber,
            issueDate,
            expectedDate,
            receivedDate,
            status,
            notes
        } = req.body;


        // =============================================
        // BASIC VALIDATION
        // =============================================

        if (!maker) {

            return res.status(400).json({

                success: false,

                message:
                    "Maker is required"

            });

        }


        if (!productionNumber || !String(productionNumber).trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Production Number is required"

            });

        }


        // =============================================
        // MAKER ID VALIDATION
        // =============================================

        if (
            !mongoose.Types.ObjectId.isValid(maker)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Maker ID"

            });

        }


        // =============================================
        // CHECK MAKER
        // =============================================

        const makerExists =
            await Maker.findOne({

                _id: maker,

                isActive: true

            });


        if (!makerExists) {

            return res.status(404).json({

                success: false,

                message:
                    "Active Maker not found"

            });

        }


        // =============================================
        // PRODUCTION NUMBER DUPLICATE
        // =============================================

        const existingProduction =
            await MakerProduction.findOne({

                productionNumber:
                    String(
                        productionNumber
                    ).trim()

            });


        if (existingProduction) {

            return res.status(409).json({

                success: false,

                message:
                    "Production Number already exists"

            });

        }


        // =============================================
        // DATE VALIDATION
        // =============================================

        if (issueDate) {

            const date =
                new Date(issueDate);

            if (
                isNaN(
                    date.getTime()
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Issue Date"

                });

            }

        }


        if (expectedDate) {

            const date =
                new Date(expectedDate);

            if (
                isNaN(
                    date.getTime()
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Expected Date"

                });

            }

        }


        if (receivedDate) {

            const date =
                new Date(receivedDate);

            if (
                isNaN(
                    date.getTime()
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Received Date"

                });

            }

        }


        // =============================================
        // DATE LOGIC
        // =============================================

        if (
            issueDate &&
            expectedDate
        ) {

            const issue =
                new Date(issueDate);

            const expected =
                new Date(expectedDate);


            if (
                expected < issue
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Expected Date cannot be before Issue Date"

                });

            }

        }


        if (
            issueDate &&
            receivedDate
        ) {

            const issue =
                new Date(issueDate);

            const received =
                new Date(receivedDate);


            if (
                received < issue
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Received Date cannot be before Issue Date"

                });

            }

        }


        // =============================================
        // STATUS VALIDATION
        // =============================================

        const allowedStatus = [

            "DRAFT",
            "ISSUED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED"

        ];


        if (
            status &&
            !allowedStatus.includes(status)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid production status"

            });

        }


        // =============================================
        // CREATE
        // =============================================

        const production =
            await MakerProduction.create({

                maker,

                productionNumber:
                    String(
                        productionNumber
                    ).trim(),

                issueDate:
                    issueDate
                        ? new Date(issueDate)
                        : new Date(),

                expectedDate:
                    expectedDate
                        ? new Date(expectedDate)
                        : null,

                receivedDate:
                    receivedDate
                        ? new Date(receivedDate)
                        : null,

                status:
                    status || "DRAFT",

                notes:
                    notes?.trim() || ""

            });


        // =============================================
        // POPULATE
        // =============================================

        await production.populate(
            "maker",
            "name phone email specialization isActive"
        );


        // =============================================
        // SUCCESS
        // =============================================

        return res.status(201).json({

            success: true,

            message:
                "Maker production created successfully",

            data:
                production

        });

    }

    catch (error) {

        console.log(
            "Create Maker Production Error:",
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
// GET ALL MAKER PRODUCTIONS
// GET /get-all-maker-productions
// =====================================================

exports.getAllMakerProductions = async (req, res) => {

    try {

        const productions =
            await MakerProduction.find()

                .populate(
                    "maker",
                    "name phone email specialization isActive"
                )

                .sort({
                    createdAt: -1
                });


        return res.status(200).json({

            success: true,

            count:
                productions.length,

            data:
                productions

        });

    }

    catch (error) {

        console.log(
            "Get All Maker Productions Error:",
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
// GET MAKER PRODUCTION BY ID
// GET /get-maker-production/:id
// =====================================================

exports.getMakerProductionById = async (req, res) => {

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
                    "Invalid Maker Production ID"

            });

        }


        // =============================================
        // FIND
        // =============================================

        const production =
            await MakerProduction.findById(id)

                .populate(
                    "maker",
                    "name phone email address specialization notes isActive"
                );


        if (!production) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker production not found"

            });

        }


        return res.status(200).json({

            success: true,

            data:
                production

        });

    }

    catch (error) {

        console.log(
            "Get Maker Production By ID Error:",
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
// GET MAKER PRODUCTIONS BY MAKER
// GET /get-maker-productions/:makerId
// =====================================================

exports.getMakerProductionsByMaker = async (req, res) => {

    try {

        const {
            makerId
        } = req.params;


        // =============================================
        // VALIDATE ID
        // =============================================

        if (
            !mongoose.Types.ObjectId.isValid(
                makerId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Maker ID"

            });

        }


        // =============================================
        // CHECK MAKER
        // =============================================

        const maker =
            await Maker.findById(
                makerId
            );


        if (!maker) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker not found"

            });

        }


        // =============================================
        // GET PRODUCTIONS
        // =============================================

        const productions =
            await MakerProduction.find({

                maker:
                    makerId

            })

                .populate(
                    "maker",
                    "name phone email specialization isActive"
                )

                .sort({

                    createdAt: -1

                });


        return res.status(200).json({

            success: true,

            maker: {

                id:
                    maker._id,

                name:
                    maker.name,

                phone:
                    maker.phone

            },

            count:
                productions.length,

            data:
                productions

        });

    }

    catch (error) {

        console.log(
            "Get Maker Productions Error:",
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
// UPDATE MAKER PRODUCTION
// PUT /update-maker-production/:id
// =====================================================

exports.updateMakerProduction = async (req, res) => {

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
                    "Invalid Maker Production ID"

            });

        }


        // =============================================
        // FIND EXISTING
        // =============================================

        const existingProduction =
            await MakerProduction.findById(id);


        if (!existingProduction) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker production not found"

            });

        }


        const {
            maker,
            productionNumber,
            issueDate,
            expectedDate,
            receivedDate,
            status,
            notes
        } = req.body;


        // =============================================
        // MAKER VALIDATION
        // =============================================

        if (
            maker !== undefined
        ) {

            if (
                !mongoose.Types.ObjectId.isValid(
                    maker
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Maker ID"

                });

            }


            const makerExists =
                await Maker.findOne({

                    _id: maker,

                    isActive: true

                });


            if (!makerExists) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Active Maker not found"

                });

            }

        }


        // =============================================
        // PRODUCTION NUMBER
        // =============================================

        if (
            productionNumber !== undefined
        ) {

            if (
                !String(
                    productionNumber
                ).trim()
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Production Number is required"

                });

            }


            const duplicate =
                await MakerProduction.findOne({

                    productionNumber:
                        String(
                            productionNumber
                        ).trim(),

                    _id: {
                        $ne: id
                    }

                });


            if (duplicate) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Production Number already exists"

                });

            }

        }


        // =============================================
        // STATUS
        // =============================================

        const allowedStatus = [

            "DRAFT",
            "ISSUED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED"

        ];


        if (
            status !== undefined &&
            !allowedStatus.includes(status)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid production status"

            });

        }


        // =============================================
        // DATE VALIDATION
        // =============================================

        const finalIssueDate =
            issueDate !== undefined
                ? new Date(issueDate)
                : existingProduction.issueDate;


        const finalExpectedDate =
            expectedDate !== undefined &&
                expectedDate !== null &&
                expectedDate !== ""
                ? new Date(expectedDate)
                : expectedDate === null ||
                    expectedDate === ""
                    ? null
                    : existingProduction.expectedDate;


        const finalReceivedDate =
            receivedDate !== undefined &&
                receivedDate !== null &&
                receivedDate !== ""
                ? new Date(receivedDate)
                : receivedDate === null ||
                    receivedDate === ""
                    ? null
                    : existingProduction.receivedDate;


        if (
            isNaN(
                finalIssueDate.getTime()
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Issue Date"

            });

        }


        if (
            finalExpectedDate &&
            isNaN(
                finalExpectedDate.getTime()
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Expected Date"

            });

        }


        if (
            finalReceivedDate &&
            isNaN(
                finalReceivedDate.getTime()
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Received Date"

            });

        }


        if (
            finalExpectedDate &&
            finalExpectedDate < finalIssueDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Expected Date cannot be before Issue Date"

            });

        }


        if (
            finalReceivedDate &&
            finalReceivedDate < finalIssueDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Received Date cannot be before Issue Date"

            });

        }


        // =============================================
        // UPDATE DATA
        // =============================================

        const updateData = {

            maker:
                maker !== undefined
                    ? maker
                    : existingProduction.maker,

            productionNumber:
                productionNumber !== undefined
                    ? String(
                        productionNumber
                    ).trim()
                    : existingProduction.productionNumber,

            issueDate:
                finalIssueDate,

            expectedDate:
                finalExpectedDate,

            receivedDate:
                finalReceivedDate,

            status:
                status !== undefined
                    ? status
                    : existingProduction.status,

            notes:
                notes !== undefined
                    ? String(notes).trim()
                    : existingProduction.notes

        };


        // =============================================
        // UPDATE
        // =============================================

        const production =
            await MakerProduction.findByIdAndUpdate(

                id,

                {
                    $set:
                        updateData
                },

                {
                    new: true,

                    runValidators: true

                }

            )

                .populate(
                    "maker",
                    "name phone email specialization isActive"
                );


        return res.status(200).json({

            success: true,

            message:
                "Maker production updated successfully",

            data:
                production

        });

    }

    catch (error) {

        console.log(
            "Update Maker Production Error:",
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
// UPDATE MAKER PRODUCTION STATUS
// PUT /update-maker-production-status/:id
// =====================================================

exports.updateMakerProductionStatus = async (req, res) => {

    try {

        const {
            id
        } = req.params;


        const {
            status
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
                    "Invalid Maker Production ID"

            });

        }


        // =============================================
        // STATUS VALIDATION
        // =============================================

        const allowedStatus = [

            "DRAFT",
            "ISSUED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED"

        ];


        if (
            !allowedStatus.includes(status)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid production status"

            });

        }


        // =============================================
        // FIND
        // =============================================

        const production =
            await MakerProduction.findById(id);


        if (!production) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker production not found"

            });

        }


        // =============================================
        // STATUS TRANSITION CHECK
        // =============================================

        if (
            production.status ===
            status
        ) {

            return res.status(400).json({

                success: false,

                message:
                    `Production is already ${status}`

            });

        }


        // =============================================
        // UPDATE
        // =============================================

        production.status =
            status;


        // =============================================
        // COMPLETED DATE
        // =============================================

        if (
            status === "COMPLETED" &&
            !production.receivedDate
        ) {

            production.receivedDate =
                new Date();

        }


        await production.save();


        await production.populate(

            "maker",

            "name phone email specialization isActive"

        );


        return res.status(200).json({

            success: true,

            message:
                `Maker production status changed to ${status}`,

            data: {

                id:
                    production._id,

                productionNumber:
                    production.productionNumber,

                status:
                    production.status,

                receivedDate:
                    production.receivedDate,

                maker:
                    production.maker

            }

        });

    }

    catch (error) {

        console.log(
            "Update Maker Production Status Error:",
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
// DELETE MAKER PRODUCTION
// DELETE /delete-maker-production/:id
// =====================================================

exports.deleteMakerProduction = async (req, res) => {

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
                    "Invalid Maker Production ID"

            });

        }


        // =============================================
        // FIND
        // =============================================

        const production =
            await MakerProduction.findById(id);


        if (!production) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker production not found"

            });

        }


        // =============================================
        // PREVENT DELETE
        // =============================================

        if (
            production.status ===
            "COMPLETED"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Completed maker production cannot be deleted"

            });

        }


        // =============================================
        // DELETE
        // =============================================

        await MakerProduction.findByIdAndDelete(
            id
        );


        return res.status(200).json({

            success: true,

            message:
                "Maker production deleted successfully",

            data: {

                id

            }

        });

    }

    catch (error) {

        console.log(
            "Delete Maker Production Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};
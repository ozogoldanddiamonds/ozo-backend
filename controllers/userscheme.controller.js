const UserScheme = require("../models/user-schema");
const Scheme = require("../models/scheme");

// ============================
// Create User Scheme
// ============================

exports.createUserScheme = async (req, res) => {

    try {

        const {

            user,

            scheme

        } = req.body;

        // ==========================
        // VALIDATION
        // ==========================

        if (!user || !scheme) {

            return res.status(400).json({

                success: false,

                message:
                    "User and Scheme are required"

            });

        }

        // ==========================
        // GET SCHEME
        // ==========================

        const schemeData =

            await Scheme.findById(scheme);

        if (!schemeData) {

            return res.status(404).json({

                success: false,

                message:
                    "Scheme not found"

            });

        }

        if (!schemeData.isActive) {

            return res.status(400).json({

                success: false,

                message:
                    "Scheme is inactive"

            });

        }

        // ==========================
        // CHECK SAME SCHEME ALREADY SUBSCRIBED
        // ==========================

        const existingScheme =

            await UserScheme.findOne({

                user,

                scheme,

                status: {
                    $in: [
                        "ACTIVE",
                        "MATURED"
                    ]
                }

            });

        if (existingScheme) {

            return res.status(400).json({

                success: false,

                message:
                    "You have already subscribed to this scheme."

            });

        }

        // ==========================
        // DATES
        // ==========================

        const startDate =
            new Date();

        const nextDueDate =
            new Date(startDate);

        nextDueDate.setMonth(

            nextDueDate.getMonth() + 1

        );

        const maturityDate =
            new Date(startDate);

        maturityDate.setMonth(

            maturityDate.getMonth() +

            schemeData.durationMonths

        );

        // ==========================
        // CREATE USER SCHEME
        // ==========================

        const userScheme =

            await UserScheme.create({

                user,

                scheme,

                schemeName:
                    schemeData.name,

                schemeAmount:
                    schemeData.amount,

                monthlyAmount:
                    schemeData.monthlyAmount,

                durationMonths:
                    schemeData.durationMonths,

                userPayMonths:
                    schemeData.userPayMonths,

                companyPayMonths:
                    schemeData.companyPayMonths,

                startDate,

                nextDueDate,

                maturityDate,

                totalInstallments:
                    schemeData.userPayMonths,

                paidInstallments: 0,

                remainingInstallments:
                    schemeData.userPayMonths,

                totalPaidAmount: 0,

                companyContribution: 0,

                remarks: "",

                status: "ACTIVE"

            });

        // ==========================
        // RESPONSE
        // ==========================

        res.status(201).json({

            success: true,

            message:
                "Scheme subscribed successfully",

            data:
                userScheme

        });

    }

    catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// ============================
// Get All User Schemes
// ============================
exports.getAllUserSchemes = async (req, res) => {

    try {

        const userSchemes =

            await UserScheme.find()

                .populate(

                    "user",

                    "name email phone"

                )

                .populate(

                    "scheme",

                    "name amount monthlyAmount"

                )

                .sort({

                    createdAt: -1

                });

        res.status(200).json({

            success: true,

            count:

                userSchemes.length,

            data:

                userSchemes

        });

    }

    catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message:

                error.message

        });

    }

};

// ============================
// Get User Scheme By Id
// ============================
exports.getUserSchemeByUserId = async (req, res) => {

    try {

        const { userId } = req.params;

        const schemes = await UserScheme.find({

            user: userId

        })

            .populate({

                path: "user",

                select:
                    "name email phone"

            })

            .populate({

                path: "scheme"

            })

            .sort({

                createdAt: -1

            });

        if (!schemes.length) {

            return res.status(404).json({

                success: false,

                message:
                    "No subscribed schemes found"

            });

        }

        res.status(200).json({

            success: true,

            count: schemes.length,

            data: schemes

        });

    }

    catch (error) {

        console.log(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

// ============================
// Update User Scheme
// ============================
exports.updateUserScheme = async (req, res) => {
    try {

        const userScheme = await UserScheme.findById(req.params.id);

        if (!userScheme) {
            return res.status(404).json({
                success: false,
                message: "User Scheme not found"
            });
        }

        const updatedScheme = await UserScheme.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: "User Scheme updated successfully",
            data: updatedScheme
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ============================
// Delete User Scheme
// ============================
exports.deleteUserScheme = async (req, res) => {
    try {

        const userScheme = await UserScheme.findById(req.params.id);

        if (!userScheme) {
            return res.status(404).json({
                success: false,
                message: "User Scheme not found"
            });
        }

        await UserScheme.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "User Scheme deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================
// Get User Scheme By Id
// ============================

exports.getUserSchemeById = async (req, res) => {

    try {

        const { userId, userSchemeId } = req.params;

        // ==========================
        // VALIDATION
        // ==========================

        if (!userId || !userSchemeId) {

            return res.status(400).json({

                success: false,

                message: "User Id and User Scheme Id are required"

            });

        }

        // ==========================
        // GET USER SCHEME
        // ==========================

        const userScheme = await UserScheme
            .findOne({
                _id: userSchemeId,
                user: userId
            })
            .populate("scheme")
            .populate("user", "-password");

        if (!userScheme) {

            return res.status(404).json({

                success: false,

                message: "Subscribed scheme not found"

            });

        }

        // ==========================
        // RESPONSE
        // ==========================

        return res.status(200).json({

            success: true,

            message: "Subscribed scheme fetched successfully",

            data: userScheme

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
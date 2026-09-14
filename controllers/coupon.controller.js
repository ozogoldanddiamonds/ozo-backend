const Coupon = require("../models/coupon");


// ======================================
// CREATE COUPON
// ======================================
exports.createCoupon = async (req, res) => {

    try {

        const {
            code,
            discountType,
            value,
            minOrderAmount,
            expiryDate,
            isActive
        } = req.body;

        const existingCoupon =
            await Coupon.findOne({
                code: code.toUpperCase()
            });

        if (existingCoupon) {

            return res.status(400).json({
                success: false,
                message: "Coupon already exists"
            });

        }

        const coupon =
            await Coupon.create({
                code,
                discountType,
                value,
                minOrderAmount,
                expiryDate,
                isActive
            });

        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            data: coupon
        });

    }
    catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ======================================
// GET ALL COUPONS
// ======================================
exports.getAllCoupons = async (req, res) => {

    try {

        const coupons =
            await Coupon.find()
                .sort({
                    createdAt: -1
                });

        res.status(200).json({
            success: true,
            count: coupons.length,
            data: coupons
        });

    }
    catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ======================================
// GET SINGLE COUPON
// ======================================
exports.getCouponById = async (req, res) => {

    try {

        const coupon =
            await Coupon.findById(
                req.params.id
            );

        if (!coupon) {

            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });

        }

        res.status(200).json({
            success: true,
            data: coupon
        });

    }
    catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ======================================
// UPDATE COUPON
// ======================================
exports.updateCoupon = async (req, res) => {

    try {

        const coupon =
            await Coupon.findByIdAndUpdate(

                req.params.id,

                req.body,

                {
                    new: true,
                    runValidators: true
                }

            );

        if (!coupon) {

            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });

        }

        res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            data: coupon
        });

    }
    catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ======================================
// DELETE COUPON
// ======================================
exports.deleteCoupon = async (req, res) => {

    try {

        const coupon =
            await Coupon.findByIdAndDelete(
                req.params.id
            );

        if (!coupon) {

            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });

        }

        res.status(200).json({
            success: true,
            message: "Coupon deleted successfully"
        });

    }
    catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};
const MetalRate = require("../models/metal-rate");

// CREATE METAL RATE
exports.createMetalRate = async (req, res) => {
    try {

        const {
            metalType,
            purity,
            unit,
            ratePerGram,
            effectiveDate
        } = req.body;

        if (!metalType) {
            return res.status(400).json({
                success: false,
                message: "Metal type is required"
            });
        }

        if (!purity) {
            return res.status(400).json({
                success: false,
                message: "Purity is required"
            });
        }

        if (!ratePerGram || ratePerGram <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid rate per gram is required"
            });
        }

        const existingRate = await MetalRate.findOne({
            metalType,
            purity,
            isActive: true
        });

        if (existingRate) {
            return res.status(409).json({
                success: false,
                message: `${metalType} ${purity} active rate already exists`
            });
        }

        const metalRate = await MetalRate.create({
            metalType,
            purity,
            unit,
            ratePerGram,
            effectiveDate
        });

        return res.status(201).json({
            success: true,
            message: "Metal rate created successfully",
            data: metalRate
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to create metal rate",
            error: error.message
        });

    }
};

// GET ALL METAL RATES
exports.getAllMetalRates = async (req, res) => {
    try {

        const {
            metalType,
            purity,
            isActive
        } = req.query;

        const filter = {};

        if (metalType) {
            filter.metalType = metalType;
        }

        if (purity) {
            filter.purity = purity;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === "true";
        }

        const rates = await MetalRate.find(filter)
            .sort({ effectiveDate: -1 });

        return res.status(200).json({
            success: true,
            count: rates.length,
            data: rates
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to fetch metal rates",
            error: error.message
        });

    }
};

// GET SINGLE METAL RATE
exports.getMetalRateById = async (req, res) => {
    try {

        const { id } = req.params;

        const rate = await MetalRate.findById(id);

        if (!rate) {
            return res.status(404).json({
                success: false,
                message: "Metal rate not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: rate
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to fetch metal rate",
            error: error.message
        });

    }
};

// UPDATE METAL RATE
exports.updateMetalRate = async (req, res) => {
    try {

        const { id } = req.params;

        const rate = await MetalRate.findById(id);

        if (!rate) {
            return res.status(404).json({
                success: false,
                message: "Metal rate not found"
            });
        }

        const updatedRate = await MetalRate.findByIdAndUpdate(
            id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Metal rate updated successfully",
            data: updatedRate
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to update metal rate",
            error: error.message
        });

    }
};

// DELETE METAL RATE
exports.deleteMetalRate = async (req, res) => {
    try {

        const { id } = req.params;

        const rate = await MetalRate.findById(id);

        if (!rate) {
            return res.status(404).json({
                success: false,
                message: "Metal rate not found"
            });
        }

        await MetalRate.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Metal rate deleted successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to delete metal rate",
            error: error.message
        });

    }
};

// TOGGLE ACTIVE STATUS
exports.toggleMetalRateStatus = async (req, res) => {
    try {

        const { id } = req.params;

        const rate = await MetalRate.findById(id);

        if (!rate) {
            return res.status(404).json({
                success: false,
                message: "Metal rate not found"
            });
        }

        rate.isActive = !rate.isActive;

        await rate.save();

        return res.status(200).json({
            success: true,
            message: `Metal rate ${rate.isActive ? "activated" : "deactivated"
                } successfully`,
            data: rate
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to update status",
            error: error.message
        });

    }
};
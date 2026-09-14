const StoneRate = require("../models/stone-rate");

// CREATE STONE RATE
exports.createStoneRate = async (req, res) => {
    try {

        const {
            stoneType,
            stoneCategory,
            quality,
            unit,
            ratePerUnit
        } = req.body;

        if (!stoneType) {
            return res.status(400).json({
                success: false,
                message: "Stone type is required"
            });
        }

        if (!ratePerUnit || ratePerUnit <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid rate per unit is required"
            });
        }

        const existingRate = await StoneRate.findOne({
            stoneType,
            stoneCategory,
            quality,
            isActive: true
        });

        if (existingRate) {
            return res.status(409).json({
                success: false,
                message: "Active stone rate already exists"
            });
        }

        const stoneRate = await StoneRate.create({
            stoneType,
            stoneCategory,
            quality,
            unit,
            ratePerUnit
        });

        return res.status(201).json({
            success: true,
            message: "Stone rate created successfully",
            data: stoneRate
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to create stone rate",
            error: error.message
        });

    }
};

// GET ALL
exports.getAllStoneRates = async (req, res) => {
    try {

        const {
            stoneType,
            stoneCategory,
            isActive
        } = req.query;

        const filter = {};

        if (stoneType) {
            filter.stoneType = stoneType;
        }

        if (stoneCategory) {
            filter.stoneCategory = stoneCategory;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === "true";
        }

        const rates = await StoneRate.find(filter)
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: rates.length,
            data: rates
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to fetch stone rates",
            error: error.message
        });

    }
};

// GET SINGLE
exports.getStoneRateById = async (req, res) => {
    try {

        const rate = await StoneRate.findById(req.params.id);

        if (!rate) {
            return res.status(404).json({
                success: false,
                message: "Stone rate not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: rate
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to fetch stone rate",
            error: error.message
        });

    }
};

// UPDATE
exports.updateStoneRate = async (req, res) => {
    try {

        const rate = await StoneRate.findById(req.params.id);

        if (!rate) {
            return res.status(404).json({
                success: false,
                message: "Stone rate not found"
            });
        }

        const updatedRate = await StoneRate.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Stone rate updated successfully",
            data: updatedRate
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to update stone rate",
            error: error.message
        });

    }
};

// DELETE
exports.deleteStoneRate = async (req, res) => {
    try {

        const rate = await StoneRate.findById(req.params.id);

        if (!rate) {
            return res.status(404).json({
                success: false,
                message: "Stone rate not found"
            });
        }

        await StoneRate.findByIdAndDelete(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Stone rate deleted successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to delete stone rate",
            error: error.message
        });

    }
};

// TOGGLE STATUS
exports.toggleStoneRateStatus = async (req, res) => {
    try {

        const rate = await StoneRate.findById(req.params.id);

        if (!rate) {
            return res.status(404).json({
                success: false,
                message: "Stone rate not found"
            });
        }

        rate.isActive = !rate.isActive;

        await rate.save();

        return res.status(200).json({
            success: true,
            message: `Stone rate ${rate.isActive ? "activated" : "deactivated"
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
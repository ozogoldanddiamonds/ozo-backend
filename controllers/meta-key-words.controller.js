
const MetaKeyWords = require("../models/meta-key-words");
const mongoose = require("mongoose");
// GET: Fetch homepage SEO settings
exports.getMetaKeyWord = async (req, res) => {
    try {
        const seo = await MetaKeyWords.findOne({
            pageKey: "home",
            isActive: true
        }).lean();

        if (!seo) {
            return res.status(404).json({
                success: false,
                message: "Meta SEO settings not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Meta SEO fetched successfully",
            data: seo
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// POST: Create or update homepage SEO settings
exports.upsertMetaKeyWordsSEO = async (req, res) => {
    try {
        const {
            metaTitle,
            metaDescription,
            metaKeywords,
            canonicalUrl,
            ogTitle,
            ogDescription,
            ogImage,
            isActive
        } = req.body;

        if (
            metaKeywords !== undefined &&
            !Array.isArray(metaKeywords)
        ) {
            return res.status(400).json({
                success: false,
                message: "metaKeywords must be an array of strings"
            });
        }

        if (
            metaKeywords !== undefined &&
            !metaKeywords.every(
                keyword => typeof keyword === "string"
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Every keyword must be a string"
            });
        }

        const keywords = metaKeywords === undefined
            ? undefined
            : [
                ...new Set(
                    metaKeywords
                        .map(keyword => keyword.trim())
                        .filter(Boolean)
                        .map(keyword => keyword.toLowerCase())
                )
            ];

        const updateData = {
            ...(metaTitle !== undefined && { metaTitle }),
            ...(metaDescription !== undefined && { metaDescription }),
            ...(keywords !== undefined && { metaKeywords: keywords }),
            ...(canonicalUrl !== undefined && { canonicalUrl }),
            ...(ogTitle !== undefined && { ogTitle }),
            ...(ogDescription !== undefined && { ogDescription }),
            ...(ogImage !== undefined && { ogImage }),
            ...(isActive !== undefined && { isActive })
        };

        const seo = await MetaKeyWords.findOneAndUpdate(
            { pageKey: "home" },
            {
                $set: updateData,
                $setOnInsert: { pageKey: "home" }
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Meta SEO saved successfully",
            data: seo
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// GET SEO BY ID
exports.getMetaKeywordsSEOById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate MongoDB ObjectId
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid SEO ID"
            });
        }

        const seo = await MetaKeyWords.findById(id);

        if (!seo) {
            return res.status(404).json({
                success: false,
                message: "SEO data not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "SEO data fetched successfully",
            data: seo
        });

    } catch (error) {
        console.error("Get SEO By ID Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch SEO data",
            error: error.message
        });
    }
};
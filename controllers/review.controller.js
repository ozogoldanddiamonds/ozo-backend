const Review = require("../models/review");
const cloudinary = require("../cloudinaryconfig");

exports.createReview = async (req, res) => {

    try {

        console.log("BODY =", req.body);
        console.log("FILES =", req.files);

        const {
            productId,
            userId,
            rating,
            title,
            text,
            tags
        } = req.body;

        // Validation

        if (!productId) {

            return res.status(400).json({
                success: false,
                message: "Product Id is required"
            });

        }

        if (!userId) {

            return res.status(400).json({
                success: false,
                message: "User Id is required"
            });

        }

        if (!rating) {

            return res.status(400).json({
                success: false,
                message: "Rating is required"
            });

        }

        const imageUrls = [];
        const videoUrls = [];

        // ==========================
        // IMAGE UPLOADS
        // ==========================

        if (
            req.files &&
            req.files.images
        ) {

            for (
                const file
                of req.files.images
            ) {

                const result =
                    await new Promise(
                        (resolve, reject) => {

                            cloudinary.uploader.upload_stream(

                                {
                                    folder: "reviews/images"
                                },

                                (error, result) => {

                                    if (error)
                                        reject(error);

                                    else
                                        resolve(result);

                                }

                            ).end(
                                file.buffer
                            );

                        }
                    );

                imageUrls.push(
                    result.secure_url
                );

            }

        }

        // ==========================
        // VIDEO UPLOADS
        // ==========================

        if (
            req.files &&
            req.files.videos
        ) {

            for (
                const file
                of req.files.videos
            ) {

                const result =
                    await new Promise(
                        (resolve, reject) => {

                            cloudinary.uploader.upload_stream(

                                {
                                    folder: "reviews/videos",
                                    resource_type: "video"
                                },

                                (error, result) => {

                                    if (error)
                                        reject(error);

                                    else
                                        resolve(result);

                                }

                            ).end(
                                file.buffer
                            );

                        }
                    );

                videoUrls.push(
                    result.secure_url
                );

            }

        }

        // ==========================
        // TAGS
        // ==========================

        let reviewTags = [];

        if (tags) {

            reviewTags =
                Array.isArray(tags)
                    ? tags
                    : [tags];

        }

        // ==========================
        // CREATE REVIEW
        // ==========================

        const review =
            await Review.create({

                productId,

                userId,

                rating,

                title,

                text,

                tags:
                    reviewTags,

                images:
                    imageUrls,

                videos:
                    videoUrls

            });

        res.status(201).json({

            success: true,

            message:
                "Review created successfully",

            data:
                review

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

exports.getAllReviews = async (req, res) => {

    try {

        const reviews =
            await Review.find()

                .populate(
                    "productId",
                    "name"
                )

                .populate(
                    "userId",
                    "name email"
                )

                .sort({
                    createdAt: -1
                });

        res.status(200).json({

            success: true,

            count:
                reviews.length,

            data:
                reviews

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

exports.getReviewById = async (req, res) => {

    try {

        const review =
            await Review.findById(
                req.params.id
            )

                .populate(
                    "productId",
                    "name"
                )

                .populate(
                    "userId",
                    "name email"
                );

        if (!review) {

            return res.status(404).json({

                success: false,

                message:
                    "Review not found"

            });

        }

        res.status(200).json({

            success: true,

            data:
                review

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

exports.getProductReviews = async (req, res) => {

    try {

        const reviews =
            await Review.find({

                productId:
                    req.params.productId,

                isActive: true,

                isApproved: true

            })

                .populate(
                    "userId",
                    "name"
                )

                .sort({
                    createdAt: -1
                });

        res.status(200).json({

            success: true,

            count:
                reviews.length,

            data:
                reviews

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

exports.updateReview = async (req, res) => {

    try {

        const review =
            await Review.findByIdAndUpdate(

                req.params.id,

                req.body,

                {
                    new: true,
                    runValidators: true
                }

            );

        if (!review) {

            return res.status(404).json({

                success: false,

                message:
                    "Review not found"

            });

        }

        res.status(200).json({

            success: true,

            message:
                "Review updated successfully",

            data:
                review

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

exports.deleteReview = async (req, res) => {

    try {

        const review =
            await Review.findByIdAndDelete(
                req.params.id
            );

        if (!review) {

            return res.status(404).json({

                success: false,

                message:
                    "Review not found"

            });

        }

        res.status(200).json({

            success: true,

            message:
                "Review deleted successfully"

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};
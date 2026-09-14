const SizeChart = require("../models/size-charts");
const cloudinary = require("../cloudinaryconfig");

exports.createSizeChart = async (req, res) => {

    try {

        let imageUrl = "";

        if (req.file) {

            const result =
                await new Promise(
                    (resolve, reject) => {

                        cloudinary.uploader.upload_stream(
                            {
                                folder: "size-charts"
                            },
                            (error, result) => {

                                if (error)
                                    reject(error);

                                else
                                    resolve(result);

                            }
                        ).end(req.file.buffer);

                    }
                );

            imageUrl =
                result.secure_url;

        }

        const sizeChart =
            await SizeChart.create({

                title:
                    req.body.title,

                subCategory:
                    req.body.subCategory,

                description:
                    req.body.description,

                image:
                    imageUrl

            });

        res.status(201).json({

            success: true,

            message:
                "Size chart created successfully",

            data:
                sizeChart

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};
exports.getAllSizeCharts = async (req, res) => {

    try {

        const sizeCharts =

            await SizeChart.find()

                .populate(
                    "subCategory",
                    "name"
                )

                .sort({
                    createdAt: -1
                });

        res.status(200).json({

            success: true,

            count:
                sizeCharts.length,

            data:
                sizeCharts

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

exports.getSizeChartBySubCategory =
    async (req, res) => {

        try {

            const sizeChart =

                await SizeChart.findOne({

                    subCategory:
                        req.params.subCategoryId,

                    isActive: true

                })

                    .populate(
                        "subCategory",
                        "name"
                    );

            if (!sizeChart) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Size chart not found"

                });

            }

            res.status(200).json({

                success: true,

                data:
                    sizeChart

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };

exports.updateSizeChart =
    async (req, res) => {

        try {

            const sizeChart =

                await SizeChart.findById(
                    req.params.id
                );

            if (!sizeChart) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Size chart not found"

                });

            }

            let imageUrl =
                sizeChart.image;

            if (req.file) {

                const result =
                    await new Promise(
                        (resolve, reject) => {

                            cloudinary.uploader.upload_stream(
                                {
                                    folder:
                                        "size-charts"
                                },
                                (
                                    error,
                                    result
                                ) => {

                                    if (error)
                                        reject(error);

                                    else
                                        resolve(result);

                                }
                            ).end(
                                req.file.buffer
                            );

                        }
                    );

                imageUrl =
                    result.secure_url;

            }

            const updatedChart =

                await SizeChart.findByIdAndUpdate(

                    req.params.id,

                    {

                        title:
                            req.body.title,

                        subCategory:
                            req.body.subCategory,

                        description:
                            req.body.description,

                        image:
                            imageUrl,

                        isActive:
                            req.body.isActive

                    },

                    {
                        new: true
                    }

                )

                    .populate(
                        "subCategory",
                        "name"
                    );

            res.status(200).json({

                success: true,

                message:
                    "Size chart updated successfully",

                data:
                    updatedChart

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };

exports.deleteSizeChart =
    async (req, res) => {

        try {

            const sizeChart =

                await SizeChart.findById(
                    req.params.id
                );

            if (!sizeChart) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Size chart not found"

                });

            }

            await SizeChart.findByIdAndDelete(
                req.params.id
            );

            res.status(200).json({

                success: true,

                message:
                    "Size chart deleted successfully"

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };
const Brand = require("../models/brand");
const cloudinary = require("../cloudinaryconfig");


// ==========================================
// CREATE BRAND
// ==========================================

const createBrand = async (req, res) => {

    try {

        const {
            name,
            code,
            description,
            isActive
        } = req.body;


        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Brand name is required"
            });

        }


        if (!code || !code.trim()) {

            return res.status(400).json({
                success: false,
                message: "Brand code is required"
            });

        }


        const brandName = name.trim();
        const brandCode = code.trim().toUpperCase();


        const existingName =
            await Brand.findOne({
                name: brandName
            });

        if (existingName) {

            return res.status(400).json({
                success: false,
                message: "Brand name already exists"
            });

        }


        const existingCode =
            await Brand.findOne({
                code: brandCode
            });

        if (existingCode) {

            return res.status(400).json({
                success: false,
                message: "Brand code already exists"
            });

        }


        let logo = "";


        // Cloudinary upload
        if (req.file) {

            const uploadResult =
                await new Promise((resolve, reject) => {

                    const stream =
                        cloudinary.uploader.upload_stream(
                            {
                                folder: "brands",
                                resource_type: "image"
                            },
                            (error, result) => {

                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(result);
                                }

                            }
                        );

                    stream.end(req.file.buffer);

                });


            logo = uploadResult.secure_url;

        }


        const brand =
            await Brand.create({

                name: brandName,

                code: brandCode,

                description:
                    description || "",

                logo: logo,

                isActive:
                    isActive === undefined
                        ? true
                        : isActive === true ||
                          isActive === "true"

            });


        return res.status(201).json({

            success: true,

            message: "Brand created successfully",

            data: brand

        });


    } catch (error) {

        console.error(
            "CREATE BRAND ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to create brand"

        });

    }

};


// ==========================================
// GET ALL BRANDS
// ==========================================

const getAllBrands = async (req, res) => {

    try {

        const brands =
            await Brand.find()
                .sort({ createdAt: -1 });


        return res.status(200).json({

            success: true,

            message: "Brands fetched successfully",

            data: brands

        });


    } catch (error) {

        console.error(
            "GET ALL BRANDS ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Failed to fetch brands"

        });

    }

};


// ==========================================
// GET ACTIVE BRANDS
// ==========================================

const getActiveBrands = async (req, res) => {

    try {

        const brands =
            await Brand.find({
                isActive: true
            })
            .sort({ name: 1 });


        return res.status(200).json({

            success: true,

            data: brands

        });


    } catch (error) {

        console.error(
            "GET ACTIVE BRANDS ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Failed to fetch active brands"

        });

    }

};


// ==========================================
// GET BRAND BY ID
// ==========================================

const getBrandById = async (req, res) => {

    try {

        const brand =
            await Brand.findById(req.params.id);


        if (!brand) {

            return res.status(404).json({

                success: false,

                message: "Brand not found"

            });

        }


        return res.status(200).json({

            success: true,

            data: brand

        });


    } catch (error) {

        console.error(
            "GET BRAND ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Failed to fetch brand"

        });

    }

};


// ==========================================
// UPDATE BRAND
// ==========================================

const updateBrand = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            name,
            code,
            description,
            isActive
        } = req.body;


        const brand =
            await Brand.findById(id);


        if (!brand) {

            return res.status(404).json({

                success: false,

                message: "Brand not found"

            });

        }


        if (!name || !name.trim()) {

            return res.status(400).json({

                success: false,

                message: "Brand name is required"

            });

        }


        if (!code || !code.trim()) {

            return res.status(400).json({

                success: false,

                message: "Brand code is required"

            });

        }


        const brandName =
            name.trim();

        const brandCode =
            code.trim().toUpperCase();


        // Duplicate name
        const existingName =
            await Brand.findOne({

                name: brandName,

                _id: { $ne: id }

            });


        if (existingName) {

            return res.status(400).json({

                success: false,

                message: "Brand name already exists"

            });

        }


        // Duplicate code
        const existingCode =
            await Brand.findOne({

                code: brandCode,

                _id: { $ne: id }

            });


        if (existingCode) {

            return res.status(400).json({

                success: false,

                message: "Brand code already exists"

            });

        }


        // Update fields
        brand.name =
            brandName;

        brand.code =
            brandCode;

        brand.description =
            description || "";


        if (isActive !== undefined) {

            brand.isActive =
                isActive === true ||
                isActive === "true";

        }


        // ==========================================
        // NEW LOGO
        // ==========================================

        if (req.file) {

            console.log(
                "Logo received:",
                req.file.originalname
            );


            const uploadResult =
                await new Promise((resolve, reject) => {

                    const stream =
                        cloudinary.uploader.upload_stream(

                            {
                                folder: "brands",
                                resource_type: "image"
                            },

                            (error, result) => {

                                if (error) {

                                    console.error(
                                        "Cloudinary Error:",
                                        error
                                    );

                                    reject(error);

                                } else {

                                    resolve(result);

                                }

                            }

                        );


                    stream.end(
                        req.file.buffer
                    );

                });


            brand.logo =
                uploadResult.secure_url;

        }


        const updatedBrand =
            await brand.save();


        return res.status(200).json({

            success: true,

            message: "Brand updated successfully",

            data: updatedBrand

        });


    } catch (error) {

        console.error(
            "UPDATE BRAND ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to update brand"

        });

    }

};


// ==========================================
// DELETE BRAND
// ==========================================

const deleteBrand = async (req, res) => {

    try {

        const brand =
            await Brand.findByIdAndDelete(
                req.params.id
            );


        if (!brand) {

            return res.status(404).json({

                success: false,

                message: "Brand not found"

            });

        }


        return res.status(200).json({

            success: true,

            message: "Brand deleted successfully"

        });


    } catch (error) {

        console.error(
            "DELETE BRAND ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Failed to delete brand"

        });

    }

};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {

    createBrand,

    getAllBrands,

    getActiveBrands,

    getBrandById,

    updateBrand,

    deleteBrand

};
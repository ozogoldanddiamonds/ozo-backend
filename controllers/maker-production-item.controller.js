const mongoose = require("mongoose");

const MakerProductionItem = require("../models/maker-production-item");
const MakerProduction = require("../models/maker-production");
const Product = require("../models/product");


// =====================================================
// HELPER: VALIDATE OBJECT ID
// =====================================================

const isValidObjectId = (id) => {

    return mongoose.Types.ObjectId.isValid(id);

};


// =====================================================
// CREATE MAKER PRODUCTION ITEM
// POST /create-maker-production-item
// =====================================================

exports.createMakerProductionItem = async (req, res) => {

    try {

        const {
            production,
            product,
            variantId,
            quantityGiven,
            quantityReceived,
            batchNumber,
            notes
        } = req.body;


        // =====================================================
        // REQUIRED VALIDATIONS
        // =====================================================

        if (!production) {

            return res.status(400).json({

                success: false,

                message:
                    "Production is required"

            });

        }


        if (!product) {

            return res.status(400).json({

                success: false,

                message:
                    "Product is required"

            });

        }


        if (!variantId) {

            return res.status(400).json({

                success: false,

                message:
                    "Variant is required"

            });

        }


        if (
            quantityGiven === undefined ||
            quantityGiven === null ||
            quantityGiven === ""
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Quantity Given is required"

            });

        }


        // =====================================================
        // OBJECT ID VALIDATION
        // =====================================================

        if (!isValidObjectId(production)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Production ID"

            });

        }


        if (!isValidObjectId(product)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Product ID"

            });

        }


        if (!isValidObjectId(variantId)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Variant ID"

            });

        }


        // =====================================================
        // QUANTITY GIVEN VALIDATION
        // =====================================================

        const given =
            Number(quantityGiven);


        if (
            !Number.isFinite(given) ||
            given < 1
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Quantity Given must be at least 1"

            });

        }


        // =====================================================
        // QUANTITY RECEIVED VALIDATION
        // =====================================================

        let received = 0;


        if (
            quantityReceived !== undefined &&
            quantityReceived !== null &&
            quantityReceived !== ""
        ) {

            received =
                Number(quantityReceived);


            if (
                !Number.isFinite(received) ||
                received < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Quantity Received must be 0 or greater"

                });

            }

        }


        // =====================================================
        // RECEIVED CANNOT EXCEED GIVEN
        // =====================================================

        if (received > given) {

            return res.status(400).json({

                success: false,

                message:
                    "Quantity Received cannot be greater than Quantity Given"

            });

        }


        // =====================================================
        // BATCH NUMBER
        // =====================================================

        const normalizedBatchNumber =
            batchNumber?.trim() || "";


        // =====================================================
        // CHECK PRODUCTION
        // =====================================================

        const productionExists =
            await MakerProduction.findById(
                production
            );


        if (!productionExists) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker production not found"

            });

        }


        // =====================================================
        // CHECK PRODUCT
        // =====================================================

        const productExists =
            await Product.findById(
                product
            );


        if (!productExists) {

            return res.status(404).json({

                success: false,

                message:
                    "Product not found"

            });

        }


        // =====================================================
        // CHECK VARIANT
        // =====================================================

        const selectedVariant =
            productExists.variants?.find(

                variant =>

                    String(variant._id) ===
                    String(variantId)

            );


        if (!selectedVariant) {

            return res.status(404).json({

                success: false,

                message:
                    "Variant not found in selected product"

            });

        }


        // =====================================================
        // DUPLICATE ITEM CHECK
        // =====================================================
        //
        // Same Product + Variant + Batch
        // cannot be added twice to the same production.
        //
        // Different batch numbers are allowed.
        //
        // Example:
        //
        // Gold Ring / SKU-001 / BATCH-001  ✅
        // Gold Ring / SKU-001 / BATCH-002  ✅
        // Gold Ring / SKU-001 / BATCH-001  ❌
        //
        // =====================================================

        const duplicateQuery = {

            production,

            product,

            variantId

        };


        // If batch number is provided,
        // compare the exact batch number.
        if (normalizedBatchNumber) {

            duplicateQuery.batchNumber =
                normalizedBatchNumber;

        }
        else {

            // If no batch number is provided,
            // only another empty batch record is duplicate.
            duplicateQuery.$or = [

                {
                    batchNumber: ""
                },

                {
                    batchNumber: {
                        $exists: false
                    }
                }

            ];

        }


        const existingItem =
            await MakerProductionItem.findOne(
                duplicateQuery
            );


        if (existingItem) {

            return res.status(409).json({

                success: false,

                message:
                    "This product variant with the same batch number is already added to the production"

            });

        }


        // =====================================================
        // AVAILABLE QUANTITY
        // =====================================================
        //
        // Initially available quantity is the quantity
        // received from maker.
        //
        // Example:
        //
        // quantityGiven    = 10
        // quantityReceived = 8
        // availableQuantity = 8
        //
        // =====================================================

        const availableQuantity =
            received;


        // =====================================================
        // CREATE ITEM
        // =====================================================

        const item =
            await MakerProductionItem.create({

                production,

                product,

                variantId,

                quantityGiven:
                    given,

                quantityReceived:
                    received,

                availableQuantity:
                    availableQuantity,

                batchNumber:
                    normalizedBatchNumber,

                notes:
                    notes?.trim() || ""

            });


        // =====================================================
        // POPULATE
        // =====================================================

        await item.populate([

            {
                path: "production"
            },

            {
                path: "product"
            }

        ]);


        // =====================================================
        // SUCCESS
        // =====================================================

        return res.status(201).json({

            success: true,

            message:
                "Maker production item created successfully",

            data:
                item

        });

    }


    catch (error) {

        console.log(
            "Create Maker Production Item Error:",
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
// GET ALL MAKER PRODUCTION ITEMS
// GET /get-all-maker-production-items
// =====================================================

exports.getAllMakerProductionItems =
    async (req, res) => {

        try {

            const items =
                await MakerProductionItem.find()

                    .populate(
                        "production",
                        "productionNumber issueDate expectedDate receivedDate status notes"
                    )

                    .populate(
                        "product"
                    )

                    .sort({
                        createdAt: -1
                    });


            return res.status(200).json({

                success: true,

                count:
                    items.length,

                data:
                    items

            });

        }

        catch (error) {

            console.log(
                "Get All Maker Production Items Error:",
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
// GET ITEMS BY PRODUCTION
// GET /get-production-items/:productionId
// =====================================================

exports.getProductionItems =
    async (req, res) => {

        try {

            const {
                productionId
            } = req.params;


            // ==========================================
            // VALIDATE ID
            // ==========================================

            if (
                !isValidObjectId(productionId)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Production ID"

                });

            }


            // ==========================================
            // CHECK PRODUCTION
            // ==========================================

            const production =
                await MakerProduction.findById(
                    productionId
                );


            if (!production) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Maker production not found"

                });

            }


            // ==========================================
            // GET ITEMS
            // ==========================================

            const items =
                await MakerProductionItem.find({

                    production:
                        productionId

                })

                    .populate(
                        "production",
                        "productionNumber issueDate expectedDate receivedDate status notes"
                    )

                    .populate(
                        "product"
                    )

                    .sort({
                        createdAt: -1
                    });


            return res.status(200).json({

                success: true,

                production: {

                    id:
                        production._id,

                    productionNumber:
                        production.productionNumber,

                    status:
                        production.status

                },

                count:
                    items.length,

                data:
                    items

            });

        }

        catch (error) {

            console.log(
                "Get Production Items Error:",
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
// GET ITEMS BY PRODUCT
// GET /get-product-production-items/:productId
// =====================================================

exports.getProductProductionItems =
    async (req, res) => {

        try {

            const {
                productId
            } = req.params;


            // ==========================================
            // VALIDATE ID
            // ==========================================

            if (
                !isValidObjectId(productId)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Product ID"

                });

            }


            // ==========================================
            // CHECK PRODUCT
            // ==========================================

            const product =
                await Product.findById(
                    productId
                );


            if (!product) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Product not found"

                });

            }


            // ==========================================
            // GET ITEMS
            // ==========================================

            const items =
                await MakerProductionItem.find({

                    product:
                        productId

                })

                    .populate(
                        "production",
                        "productionNumber issueDate expectedDate receivedDate status"
                    )

                    .populate(
                        "product"
                    )

                    .sort({
                        createdAt: -1
                    });


            return res.status(200).json({

                success: true,

                product: {

                    id:
                        product._id

                },

                count:
                    items.length,

                data:
                    items

            });

        }

        catch (error) {

            console.log(
                "Get Product Production Items Error:",
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
// GET ITEMS BY VARIANT
// GET /get-variant-production-items/:variantId
// =====================================================

exports.getVariantProductionItems =
    async (req, res) => {

        try {

            const {
                variantId
            } = req.params;


            // ==========================================
            // VALIDATE ID
            // ==========================================

            if (
                !isValidObjectId(variantId)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Variant ID"

                });

            }


            // ==========================================
            // FIND ITEMS
            // ==========================================

            const items =
                await MakerProductionItem.find({

                    variantId

                })

                    .populate(
                        "production",
                        "productionNumber issueDate expectedDate receivedDate status"
                    )

                    .populate(
                        "product"
                    )

                    .sort({
                        createdAt: -1
                    });


            return res.status(200).json({

                success: true,

                count:
                    items.length,

                data:
                    items

            });

        }

        catch (error) {

            console.log(
                "Get Variant Production Items Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };


exports.getMakerProductionItemById =
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            if (
                !mongoose.Types.ObjectId.isValid(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Maker Production Item ID"

                });

            }


            const item =
                await MakerProductionItem.findById(id)

                    .populate(
                        "production",
                        "productionNumber issueDate expectedDate receivedDate status notes"
                    )

                    .populate(
                        "product"
                    );


            if (!item) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Maker production item not found"

                });

            }


            return res.status(200).json({

                success: true,

                data:
                    item

            });

        }

        catch (error) {

            console.log(
                "Get Maker Production Item By ID Error:",
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
// UPDATE MAKER PRODUCTION ITEM
// PUT /update-maker-production-item/:id
// =====================================================

exports.updateMakerProductionItem = async (req, res) => {

    try {

        const { id } = req.params;


        // =====================================================
        // VALIDATE ID
        // =====================================================

        if (!isValidObjectId(id)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Maker Production Item ID"

            });

        }


        // =====================================================
        // FIND EXISTING ITEM
        // =====================================================

        const existingItem =
            await MakerProductionItem.findById(id);


        if (!existingItem) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker production item not found"

            });

        }


        // =====================================================
        // REQUEST BODY
        // =====================================================

        const {
            production,
            product,
            variantId,
            quantityGiven,
            quantityReceived,
            batchNumber,
            notes
        } = req.body;


        // =====================================================
        // FINAL VALUES
        // =====================================================

        const finalProduction =
            production !== undefined
                ? production
                : existingItem.production;


        const finalProduct =
            product !== undefined
                ? product
                : existingItem.product;


        const finalVariantId =
            variantId !== undefined
                ? variantId
                : existingItem.variantId;


        const finalQuantityGiven =
            quantityGiven !== undefined
                ? Number(quantityGiven)
                : Number(existingItem.quantityGiven);


        const finalQuantityReceived =
            quantityReceived !== undefined
                ? Number(quantityReceived)
                : Number(existingItem.quantityReceived);


        const finalBatchNumber =
            batchNumber !== undefined
                ? String(batchNumber).trim()
                : String(existingItem.batchNumber || "").trim();


        // =====================================================
        // OBJECT ID VALIDATION
        // =====================================================

        if (!isValidObjectId(finalProduction)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Production ID"

            });

        }


        if (!isValidObjectId(finalProduct)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Product ID"

            });

        }


        if (!isValidObjectId(finalVariantId)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Variant ID"

            });

        }


        // =====================================================
        // QUANTITY GIVEN VALIDATION
        // =====================================================

        if (
            !Number.isFinite(finalQuantityGiven) ||
            finalQuantityGiven < 1
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Quantity Given must be at least 1"

            });

        }


        // =====================================================
        // QUANTITY RECEIVED VALIDATION
        // =====================================================

        if (
            !Number.isFinite(finalQuantityReceived) ||
            finalQuantityReceived < 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Quantity Received must be 0 or greater"

            });

        }


        // =====================================================
        // RECEIVED CANNOT EXCEED GIVEN
        // =====================================================

        if (
            finalQuantityReceived >
            finalQuantityGiven
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Quantity Received cannot be greater than Quantity Given"

            });

        }


        // =====================================================
        // CALCULATE ALREADY SOLD / USED QUANTITY
        // =====================================================
        //
        // Example:
        //
        // quantityReceived = 10
        // availableQuantity = 7
        //
        // Already used/sold = 3
        //
        // =====================================================

        const currentQuantityReceived =
            Number(
                existingItem.quantityReceived
            ) || 0;


        const currentAvailableQuantity =
            Number(
                existingItem.availableQuantity
            ) || 0;


        const usedQuantity =
            Math.max(

                currentQuantityReceived -
                currentAvailableQuantity,

                0

            );


        // =====================================================
        // NEW RECEIVED QUANTITY CANNOT BE LESS
        // THAN ALREADY USED QUANTITY
        // =====================================================

        if (
            finalQuantityReceived <
            usedQuantity
        ) {

            return res.status(400).json({

                success: false,

                message:
                    `Quantity Received cannot be less than already used quantity (${usedQuantity})`

            });

        }


        // =====================================================
        // NEW AVAILABLE QUANTITY
        // =====================================================

        const finalAvailableQuantity =
            finalQuantityReceived -
            usedQuantity;


        // =====================================================
        // CHECK PRODUCTION
        // =====================================================

        const productionExists =
            await MakerProduction.findById(
                finalProduction
            );


        if (!productionExists) {

            return res.status(404).json({

                success: false,

                message:
                    "Maker production not found"

            });

        }


        // =====================================================
        // CHECK PRODUCT
        // =====================================================

        const productExists =
            await Product.findById(
                finalProduct
            );


        if (!productExists) {

            return res.status(404).json({

                success: false,

                message:
                    "Product not found"

            });

        }


        // =====================================================
        // CHECK VARIANT
        // =====================================================

        const selectedVariant =
            productExists.variants?.find(

                variant =>

                    String(variant._id) ===
                    String(finalVariantId)

            );


        if (!selectedVariant) {

            return res.status(404).json({

                success: false,

                message:
                    "Variant not found in selected product"

            });

        }


        // =====================================================
        // DUPLICATE CHECK
        // =====================================================
        //
        // Same:
        //
        // production
        // + product
        // + variant
        // + batch number
        //
        // cannot exist twice.
        //
        // Different batch numbers are allowed.
        //
        // =====================================================

        const duplicateQuery = {

            production:
                finalProduction,

            product:
                finalProduct,

            variantId:
                finalVariantId,

            _id: {
                $ne: id
            }

        };


        // =====================================================
        // BATCH NUMBER CHECK
        // =====================================================

        if (finalBatchNumber) {

            duplicateQuery.batchNumber =
                finalBatchNumber;

        }
        else {

            // Empty batch number should match
            // another empty/missing batch number.

            duplicateQuery.$or = [

                {
                    batchNumber: ""
                },

                {
                    batchNumber: {
                        $exists: false
                    }
                }

            ];

        }


        const duplicate =
            await MakerProductionItem.findOne(
                duplicateQuery
            );


        if (duplicate) {

            return res.status(409).json({

                success: false,

                message:
                    "This product variant with the same batch number is already added to the production"

            });

        }


        // =====================================================
        // UPDATE ITEM
        // =====================================================

        const item =
            await MakerProductionItem.findByIdAndUpdate(

                id,

                {

                    production:
                        finalProduction,

                    product:
                        finalProduct,

                    variantId:
                        finalVariantId,

                    quantityGiven:
                        finalQuantityGiven,

                    quantityReceived:
                        finalQuantityReceived,

                    availableQuantity:
                        finalAvailableQuantity,

                    batchNumber:
                        finalBatchNumber,

                    notes:
                        notes !== undefined
                            ? String(notes).trim()
                            : existingItem.notes

                },

                {

                    new: true,

                    runValidators: true

                }

            )
                .populate("production")
                .populate("product");


        // =====================================================
        // SUCCESS
        // =====================================================

        return res.status(200).json({

            success: true,

            message:
                "Maker production item updated successfully",

            data:
                item

        });

    }


    catch (error) {

        console.log(
            "Update Maker Production Item Error:",
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
// DELETE MAKER PRODUCTION ITEM
// DELETE /delete-maker-production-item/:id
// =====================================================

exports.deleteMakerProductionItem =
    async (req, res) => {

        try {

            const {
                id
            } = req.params;


            // ==========================================
            // VALIDATE ID
            // ==========================================

            if (
                !isValidObjectId(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Maker Production Item ID"

                });

            }


            // ==========================================
            // FIND
            // ==========================================

            const item =
                await MakerProductionItem.findById(
                    id
                )

                    .populate(
                        "production",
                        "productionNumber status"
                    );


            if (!item) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Maker production item not found"

                });

            }


            // ==========================================
            // COMPLETED PROTECTION
            // ==========================================

            if (
                item.production?.status ===
                "COMPLETED"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Items from a completed maker production cannot be deleted"

                });

            }


            // ==========================================
            // DELETE
            // ==========================================

            await MakerProductionItem.findByIdAndDelete(
                id
            );


            return res.status(200).json({

                success: true,

                message:
                    "Maker production item deleted successfully",

                data: {

                    id

                }

            });

        }

        catch (error) {

            console.log(
                "Delete Maker Production Item Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    };
const Product = require("../models/product");
const Admin = require("../models/user");
const SubBranchProduct = require("../models/subbranch-product");

// ASSIGN PRODUCT

exports.assignProductToSubBranch = async (req, res) => {

    try {

        const {
            subBranchId,
            productId,
            variantId,
            quantity
        } = req.body;

        if (
            !subBranchId ||
            !productId ||
            !variantId ||
            quantity === undefined
        ) {

            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });

        }

        const subBranch = await Admin.findOne({
            _id: subBranchId,
            role: "SUB_BRANCH"
        });

        if (!subBranch) {

            return res.status(404).json({
                success: false,
                message: "Sub Branch not found"
            });

        }

        const product = await Product.findById(productId);

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });

        }

        const variant = product.variants.id(variantId);

        if (!variant) {

            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });

        }

        if (variant.stock < quantity) {

            return res.status(400).json({
                success: false,
                message: "Insufficient Stock"
            });

        }

        let assignedProduct =
            await SubBranchProduct.findOne({

branchId: req.user.id,
                subBranchId,
                productId,
                variantId

            });

        if (assignedProduct) {

            assignedProduct.assignedQuantity += Number(quantity);

            await assignedProduct.save();

        }

        else {

            assignedProduct =
                await SubBranchProduct.create({
branchId: req.user.id,
                    // branchId: subBranch.branchId,

                    subBranchId,

                    productId,

                    variantId,

                    assignedQuantity: Number(quantity),

                    assignedBy: req.user?.id || null

                });

        }

        variant.stock -= Number(quantity);

        await product.save();

        res.status(200).json({

            success: true,

            message: "Product Assigned Successfully",

            data: assignedProduct

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};




// GET ASSIGNED PRODUCTS

exports.getAssignedProducts = async (req, res) => {

    try {

        const subBranchId = req.user.id;

        const assignedProducts =
            await SubBranchProduct.find({

                subBranchId

            })

            .populate({

                path: "productId",

                populate: [

                    {
                        path: "category",
                        select: "name"
                    }

                ]

            })

            .lean();

        const data = assignedProducts.map(item => {

            const variant =
                item.productId.variants.find(

                    v =>

                        v._id.toString() ===

                        item.variantId.toString()

                );

            return {

                _id: item._id,

                assignedQuantity:
                item.assignedQuantity,

                productId:
                item.productId,

                variant

            };

        });

        res.json({

            success: true,

            data

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};



// RETURN STOCK

exports.returnAssignedProduct = async (req, res) => {

    try {

        const {
            assignedProductId,
            quantity
        } = req.body;

        // ===============================
        // Validation
        // ===============================

        if (!assignedProductId || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: "assignedProductId and quantity are required"
            });
        }

        if (Number(quantity) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Quantity should be greater than zero"
            });
        }

        // ===============================
        // Find Assigned Product
        // ===============================

        const assigned = await SubBranchProduct.findById(assignedProductId);

        if (!assigned) {
            return res.status(404).json({
                success: false,
                message: "Assigned Product Not Found"
            });
        }

        // ===============================
        // Check Assigned Quantity
        // ===============================

        if (assigned.assignedQuantity < Number(quantity)) {
            return res.status(400).json({
                success: false,
                message: "Return quantity exceeds assigned quantity"
            });
        }

        // ===============================
        // Find Product
        // ===============================

        const product = await Product.findById(assigned.productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product Not Found"
            });
        }

        // ===============================
        // Find Variant
        // ===============================

        const variant = product.variants.id(assigned.variantId);

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant Not Found"
            });
        }

        // ===============================
        // Return Stock
        // ===============================

        variant.stock += Number(quantity);

        // ===============================
        // Reduce Assigned Quantity
        // ===============================

        assigned.assignedQuantity -= Number(quantity);

        // Save Product Stock
        await product.save();

        // Delete or Update Assigned Record
        if (assigned.assignedQuantity === 0) {

            await SubBranchProduct.findByIdAndDelete(
                assigned._id
            );

        } else {

            await assigned.save();

        }

        // ===============================
        // Response
        // ===============================

        return res.status(200).json({
            success: true,
            message: "Stock Returned Successfully",
            data: {
                productId: product._id,
                variantId: variant._id,
                returnedQuantity: Number(quantity),
                remainingAssignedQuantity: assigned.assignedQuantity
            }
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.assignMultipleProducts = async (req, res) => {

    try {

        const {
            subBranchId,
            productId,
            variants
        } = req.body;

        if (
            !subBranchId ||
            !productId ||
            !variants ||
            variants.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing"
            });
        }

        const subBranch = await Admin.findOne({
            _id: subBranchId,
            role: "SUB_BRANCH"
        });

        if (!subBranch) {
            return res.status(404).json({
                success: false,
                message: "Sub Branch not found"
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        for (const item of variants) {

            const variant = product.variants.id(item.variantId);

            if (!variant) {
                continue;
            }

            if (variant.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `${variant.sku} stock not available`
                });
            }

            let assignedProduct =
                await SubBranchProduct.findOne({

                    branchId: req.user.id,

                    subBranchId,

                    productId,

                    variantId: item.variantId

                });

            if (assignedProduct) {

                assignedProduct.assignedQuantity += Number(item.quantity);

                await assignedProduct.save();

            } else {

                await SubBranchProduct.create({

                    branchId: req.user.id,

                    subBranchId,

                    productId,

                    variantId: item.variantId,

                    assignedQuantity: Number(item.quantity),

                    assignedBy: req.user.id

                });

            }

            variant.stock -= Number(item.quantity);

        }

        await product.save();

        return res.status(200).json({

            success: true,

            message: "Products Assigned Successfully"

        });

    }

    catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


exports.getAssignedProductsBySubBranch = async (req, res) => {

    try {

        // Branch login -> req.params.subBranchId
        // Sub Branch login -> req.user.id

        const subBranchId =

            req.params.subBranchId ||

            req.user.id;

        const assignedProducts =

            await SubBranchProduct.find({

                subBranchId

            })

            .populate({

                path: "productId",

                populate: [

                    {
                        path: "category",
                        select: "name"
                    },

                    {
                        path: "subCategory",
                        select: "name"
                    },

                    {
                        path: "subSubCategory",
                        select: "name"
                    }

                ]

            })

            .lean();

        const data = assignedProducts.map(item => {

            const variant =

                item.productId.variants.find(

                    v =>

                        v._id.toString() ===

                        item.variantId.toString()

                );

            return {

                _id: item._id,

                assignedQuantity: item.assignedQuantity,

                productId: item.productId,

                variant

            };

        });

        res.status(200).json({

            success: true,

            data

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};
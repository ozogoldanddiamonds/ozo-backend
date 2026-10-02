const SupplierPurchaseItem = require("../models/supplier-purchase-items");
const SupplierPurchase = require("../models/supplier-purchase");
const Product = require("../models/product");



// =====================================================
// CREATE SUPPLIER PURCHASE ITEM
// =====================================================
exports.createSupplierPurchaseItem = async (req, res) => {
    try {

        const {
            purchase,
            product,
            variantId,
            quantity,
            purchasePrice,
            supplierProductCode,
            batchNumber,
            discount,
            tax,
            totalAmount,
            notes
        } = req.body;


        // ==========================================
        // 1. BASIC VALIDATION
        // ==========================================

        if (!purchase) {
            return res.status(400).json({
                success: false,
                message: "Purchase is required"
            });
        }

        if (!product) {
            return res.status(400).json({
                success: false,
                message: "Product is required"
            });
        }

        if (!variantId) {
            return res.status(400).json({
                success: false,
                message: "Variant is required"
            });
        }

        const purchaseQuantity = Number(quantity);

        if (!purchaseQuantity || purchaseQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be greater than 0"
            });
        }


        // ==========================================
        // 2. CHECK SUPPLIER PURCHASE
        // ==========================================

        const purchaseExists = await SupplierPurchase.findById(purchase);

        if (!purchaseExists) {
            return res.status(404).json({
                success: false,
                message: "Supplier Purchase not found"
            });
        }


        // ==========================================
        // 3. CHECK PRODUCT
        // ==========================================

        const existingProduct = await Product.findById(product);

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        // ==========================================
        // 4. CHECK VARIANT INSIDE PRODUCT
        // ==========================================

        const selectedVariant = existingProduct.variants.find(
            variant =>
                String(variant._id) === String(variantId)
        );

        if (!selectedVariant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found in selected product"
            });
        }


        // ==========================================
        // 5. CHECK DUPLICATE ITEM
        // ==========================================

        const existingItem = await SupplierPurchaseItem.findOne({
            purchase: purchase,
            product: product,
            variantId: variantId
        });

        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: "This product variant is already added to this purchase"
            });
        }


        // ==========================================
        // 6. CREATE SUPPLIER PURCHASE ITEM
        // ==========================================

        const newItem = await SupplierPurchaseItem.create({

            purchase: purchase,

            product: product,

            variantId: variantId,

            quantity: purchaseQuantity,

            // Initially available quantity
            availableQuantity: purchaseQuantity,

            purchasePrice: Number(purchasePrice) || 0,

            supplierProductCode:
                supplierProductCode || "",

            batchNumber:
                batchNumber || "",

            discount:
                Number(discount) || 0,

            tax:
                Number(tax) || 0,

            totalAmount:
                Number(totalAmount) || 0,

            notes:
                notes || ""
        });


        // ==========================================
        // 7. UPDATE PRODUCT VARIANT STOCK
        // ==========================================

        // Current stock
        const oldStock =
            Number(selectedVariant.stock) || 0;


        // Add purchased quantity
        const newStock =
            oldStock + purchaseQuantity;


        // Update variant stock
        selectedVariant.stock = newStock;


        // Save Product
        await existingProduct.save();


        // ==========================================
        // 8. POPULATE RESPONSE
        // ==========================================

        const populatedItem =
            await SupplierPurchaseItem.findById(newItem._id)
                .populate("purchase")
                .populate("product");


        // ==========================================
        // 9. SUCCESS RESPONSE
        // ==========================================

        return res.status(201).json({

            success: true,

            message:
                "Supplier Purchase Item created and product stock updated successfully",

            data: populatedItem,

            stock: {
                previousStock: oldStock,

                purchasedQuantity: purchaseQuantity,

                currentStock: newStock
            }
        });


    } catch (error) {

        console.error(
            "Create Supplier Purchase Item Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message
        });
    }
};

// =====================================================
// GET ALL SUPPLIER PURCHASE ITEMS
// =====================================================

exports.getAllSupplierPurchaseItems = async (
    req,
    res
) => {

    try {

        const items =
            await SupplierPurchaseItem
                .find()
                .populate({
                    path: "purchase",
                    populate: {
                        path: "supplier"
                    }
                })
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

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// getbyid
exports.getSupplierPurchaseItemById = async (req, res) => {

    try {

        const { id } = req.params;

        const item = await SupplierPurchaseItem
            .findById(id)
            .populate({
                path: "purchase",
                populate: {
                    path: "supplier"
                }
            })
            .populate("product");

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Supplier purchase item not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: item
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// =====================================================
// GET ITEMS BY PURCHASE
// =====================================================

exports.getPurchaseItemsByPurchase = async (
    req,
    res
) => {

    try {

        const { purchaseId } =
            req.params;


        const purchase =
            await SupplierPurchase.findById(
                purchaseId
            );

        if (!purchase) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        const items =
            await SupplierPurchaseItem
                .find({
                    purchase:
                        purchaseId
                })
                .populate(
                    "product"
                )
                .sort({
                    createdAt: 1
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

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// GET PURCHASE ITEMS BY PRODUCT
// =====================================================

exports.getPurchaseItemsByProduct = async (
    req,
    res
) => {

    try {

        const { productId } =
            req.params;


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


        const items =
            await SupplierPurchaseItem
                .find({
                    product:
                        productId
                })
                .populate({
                    path: "purchase",
                    populate: {
                        path: "supplier"
                    }
                })
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

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// GET PURCHASE ITEMS BY VARIANT
// =====================================================

exports.getPurchaseItemsByVariant = async (
    req,
    res
) => {

    try {

        const { variantId } =
            req.params;


        const items =
            await SupplierPurchaseItem
                .find({
                    variantId
                })
                .populate({
                    path: "purchase",
                    populate: {
                        path: "supplier"
                    }
                })
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

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};

// =====================================================
// UPDATE SUPPLIER PURCHASE ITEM
// =====================================================

exports.updateSupplierPurchaseItem = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        // ==========================================
        // REQUEST BODY
        // ==========================================

        const {
            purchase,              // ✅ ADDED
            product,
            variantId,
            quantity,
            purchasePrice,
            supplierProductCode,
            batchNumber,
            discount,
            tax,
            totalAmount,
            notes
        } = req.body;


        // ==========================================
        // FIND ITEM
        // ==========================================

        const item =
            await SupplierPurchaseItem.findById(id);


        if (!item) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase item not found"

            });

        }


        // ==========================================
        // SUPPLIER PURCHASE UPDATE
        // ==========================================

        if (purchase !== undefined) {

            const purchaseExists =
                await SupplierPurchase.findById(
                    purchase
                );


            if (!purchaseExists) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Supplier purchase not found"

                });

            }


            // ✅ Update Supplier Purchase
            item.purchase =
                purchase;

        }


        // ==========================================
        // PRODUCT UPDATE
        // ==========================================

        if (product !== undefined) {

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


            // If variant is also being updated,
            // validate it against new product

            const selectedVariantId =
                variantId !== undefined
                    ? variantId
                    : item.variantId;


            const variantExists =
                productExists.variants?.some(
                    variant =>
                        String(variant._id) ===
                        String(selectedVariantId)
                );


            if (!variantExists) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Variant not found in selected product"

                });

            }


            item.product =
                product;

        }


        // ==========================================
        // VARIANT UPDATE
        // ==========================================

        if (variantId !== undefined) {

            const productId =
                product !== undefined
                    ? product
                    : item.product;


            const productExists =
                await Product.findById(
                    productId
                );


            if (!productExists) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Product not found"

                });

            }


            const variantExists =
                productExists.variants?.some(
                    variant =>
                        String(variant._id) ===
                        String(variantId)
                );


            if (!variantExists) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Variant not found in selected product"

                });

            }


            item.variantId =
                variantId;

        }


        // ==========================================
        // QUANTITY UPDATE
        // ==========================================

        if (quantity !== undefined) {

            const newQuantity =
                Number(quantity);


            if (
                !Number.isFinite(newQuantity) ||
                newQuantity < 1
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Quantity must be at least 1"

                });

            }


            // --------------------------------------
            // Calculate already sold quantity
            // --------------------------------------

            const currentQuantity =
                Number(item.quantity) || 0;

            const currentAvailable =
                Number(item.availableQuantity) || 0;


            const soldQuantity =
                Math.max(
                    currentQuantity -
                    currentAvailable,
                    0
                );


            // --------------------------------------
            // New quantity cannot be less than
            // already sold quantity
            // --------------------------------------

            if (
                newQuantity <
                soldQuantity
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `Quantity cannot be less than sold quantity (${soldQuantity})`

                });

            }


            // --------------------------------------
            // Update quantity
            // --------------------------------------

            item.quantity =
                newQuantity;


            // --------------------------------------
            // Recalculate available quantity
            // --------------------------------------

            item.availableQuantity =
                newQuantity -
                soldQuantity;

        }


        // ==========================================
        // PURCHASE PRICE
        // ==========================================

        if (purchasePrice !== undefined) {

            const newPurchasePrice =
                Number(purchasePrice);


            if (
                !Number.isFinite(
                    newPurchasePrice
                ) ||
                newPurchasePrice < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid purchase price is required"

                });

            }


            item.purchasePrice =
                newPurchasePrice;

        }


        // ==========================================
        // SUPPLIER PRODUCT CODE
        // ==========================================

        if (
            supplierProductCode !== undefined
        ) {

            item.supplierProductCode =
                supplierProductCode;

        }


        // ==========================================
        // BATCH NUMBER
        // ==========================================

        if (
            batchNumber !== undefined
        ) {

            item.batchNumber =
                batchNumber;

        }


        // ==========================================
        // DISCOUNT
        // ==========================================

        if (
            discount !== undefined
        ) {

            const newDiscount =
                Number(discount);


            if (
                !Number.isFinite(newDiscount) ||
                newDiscount < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Discount must be 0 or greater"

                });

            }


            item.discount =
                newDiscount;

        }


        // ==========================================
        // TAX
        // ==========================================

        if (
            tax !== undefined
        ) {

            const newTax =
                Number(tax);


            if (
                !Number.isFinite(newTax) ||
                newTax < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Tax must be 0 or greater"

                });

            }


            item.tax =
                newTax;

        }


        // ==========================================
        // TOTAL AMOUNT
        // ==========================================

        if (
            totalAmount !== undefined
        ) {

            const newTotalAmount =
                Number(totalAmount);


            if (
                !Number.isFinite(
                    newTotalAmount
                ) ||
                newTotalAmount < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Total amount must be 0 or greater"

                });

            }


            item.totalAmount =
                newTotalAmount;

        }


        // ==========================================
        // NOTES
        // ==========================================

        if (
            notes !== undefined
        ) {

            item.notes =
                notes?.trim() || "";

        }


        // ==========================================
        // SAVE
        // ==========================================

        console.log(
            "ITEM BEFORE SAVE:",
            item.toObject()
        );


        await item.save();


        console.log(
            "ITEM AFTER SAVE:",
            item.toObject()
        );


        // ==========================================
        // POPULATE
        // ==========================================

        await item.populate([

            {
                path: "purchase",

                populate: {
                    path: "supplier"
                }

            },

            {
                path: "product"

            }

        ]);


        // ==========================================
        // SUCCESS
        // ==========================================

        return res.status(200).json({

            success: true,

            message:
                "Supplier purchase item updated successfully",

            data:
                item

        });

    }


    catch (error) {

        console.log(
            "Update Supplier Purchase Item Error:",
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
// DELETE SUPPLIER PURCHASE ITEM
// =====================================================

exports.deleteSupplierPurchaseItem = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        const item =
            await SupplierPurchaseItem.findById(
                id
            );

        if (!item) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase item not found"

            });

        }


        await SupplierPurchaseItem.findByIdAndDelete(
            id
        );


        return res.status(200).json({

            success: true,

            message:
                "Supplier purchase item deleted successfully"

        });

    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};
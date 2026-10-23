const mongoose = require("mongoose");
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
exports.updateSupplierPurchaseItem = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        let responseData = null;

        await session.withTransaction(async () => {
            const { id } = req.params;

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

            // 1. Find Supplier Purchase Item
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("Invalid supplier purchase item ID");
            }

            const item = await SupplierPurchaseItem.findById(id)
                .session(session);

            if (!item) {
                throw new Error("Supplier purchase item not found");
            }

            // 2. Resolve final IDs
            const finalPurchase = purchase ?? item.purchase;
            const finalProduct = product ?? item.product;
            const finalVariantId = variantId ?? item.variantId;

            if (
                !mongoose.Types.ObjectId.isValid(finalPurchase) ||
                !mongoose.Types.ObjectId.isValid(finalProduct) ||
                !mongoose.Types.ObjectId.isValid(finalVariantId)
            ) {
                throw new Error(
                    "Invalid purchase, product, or variant ID"
                );
            }

            // 3. Validate Supplier Purchase
            const purchaseExists = await SupplierPurchase.findById(
                finalPurchase
            ).session(session);

            if (!purchaseExists) {
                throw new Error("Supplier purchase not found");
            }

            // 4. Find Product using product ID
            const productDoc = await Product.findById(
                finalProduct
            ).session(session);

            if (!productDoc) {
                throw new Error("Product not found");
            }

            // 5. Find exact variant using Product.variants._id
            const selectedVariant = productDoc.variants.id(
                finalVariantId
            );

            if (!selectedVariant) {
                throw new Error(
                    "Selected variant not found in this product"
                );
            }

            // 6. Validate quantity
            const oldQuantity = Number(item.quantity || 0);
            const oldAvailableQuantity = Number(
                item.availableQuantity || 0
            );

            const finalQuantity =
                quantity !== undefined
                    ? Number(quantity)
                    : oldQuantity;

            if (
                !Number.isFinite(finalQuantity) ||
                finalQuantity < 1
            ) {
                throw new Error("Quantity must be at least 1");
            }

            // Preserve quantity already sold
            const soldQuantity = Math.max(
                oldQuantity - oldAvailableQuantity,
                0
            );

            if (finalQuantity < soldQuantity) {
                throw new Error(
                    `Quantity cannot be less than sold quantity (${soldQuantity})`
                );
            }

            const finalAvailableQuantity =
                finalQuantity - soldQuantity;

            // 7. Update Supplier Purchase Item fields
            item.purchase = finalPurchase;
            item.product = finalProduct;
            item.variantId = finalVariantId;
            item.quantity = finalQuantity;
            item.availableQuantity = finalAvailableQuantity;

            // 8. Purchase price
            if (purchasePrice !== undefined) {
                const value = Number(purchasePrice);

                if (!Number.isFinite(value) || value < 0) {
                    throw new Error(
                        "Valid purchase price is required"
                    );
                }

                item.purchasePrice = value;
            }

            // 9. Supplier product code
            if (supplierProductCode !== undefined) {
                item.supplierProductCode = supplierProductCode;
            }

            // 10. Batch number
            if (batchNumber !== undefined) {
                item.batchNumber = batchNumber;
            }

            // 11. Discount
            if (discount !== undefined) {
                const value = Number(discount);

                if (!Number.isFinite(value) || value < 0) {
                    throw new Error(
                        "Discount must be 0 or greater"
                    );
                }

                item.discount = value;
            }

            // 12. Tax
            if (tax !== undefined) {
                const value = Number(tax);

                if (!Number.isFinite(value) || value < 0) {
                    throw new Error("Tax must be 0 or greater");
                }

                item.tax = value;
            }

            // 13. Total amount
            if (totalAmount !== undefined) {
                const value = Number(totalAmount);

                if (!Number.isFinite(value) || value < 0) {
                    throw new Error(
                        "Total amount must be 0 or greater"
                    );
                }

                item.totalAmount = value;
            }

            // 14. Notes
            if (notes !== undefined) {
                item.notes = notes?.trim() || "";
            }

            // 15. Update the matched Product variant stock
            // Product ID + Variant ID identifies the exact variant.
            selectedVariant.stock = finalAvailableQuantity;

            // Save both changes in the same transaction
            await productDoc.save({ session });
            await item.save({ session });

            // 16. Return updated item
            responseData = await SupplierPurchaseItem.findById(
                item._id
            )
                .populate({
                    path: "purchase",
                    populate: {
                        path: "supplier"
                    }
                })
                .populate("product")
                .session(session);
        });

        return res.status(200).json({
            success: true,
            message:
                "Supplier purchase item and product variant updated successfully",
            data: responseData
        });

    } catch (error) {
        console.error(
            "Update Supplier Purchase Item Error:",
            error
        );

        return res.status(400).json({
            success: false,
            message:
                error.message ||
                "Failed to update supplier purchase item"
        });

    } finally {
        await session.endSession();
    }
};
// exports.updateSupplierPurchaseItem = async (
//     req,
//     res
// ) => {

//     try {

//         const { id } =
//             req.params;


//         // ==========================================
//         // REQUEST BODY
//         // ==========================================

//         const {
//             purchase,              // ✅ ADDED
//             product,
//             variantId,
//             quantity,
//             purchasePrice,
//             supplierProductCode,
//             batchNumber,
//             discount,
//             tax,
//             totalAmount,
//             notes
//         } = req.body;


//         // ==========================================
//         // FIND ITEM
//         // ==========================================

//         const item =
//             await SupplierPurchaseItem.findById(id);


//         if (!item) {

//             return res.status(404).json({

//                 success: false,

//                 message:
//                     "Supplier purchase item not found"

//             });

//         }


//         // ==========================================
//         // SUPPLIER PURCHASE UPDATE
//         // ==========================================

//         if (purchase !== undefined) {

//             const purchaseExists =
//                 await SupplierPurchase.findById(
//                     purchase
//                 );


//             if (!purchaseExists) {

//                 return res.status(404).json({

//                     success: false,

//                     message:
//                         "Supplier purchase not found"

//                 });

//             }


//             // ✅ Update Supplier Purchase
//             item.purchase =
//                 purchase;

//         }


//         // ==========================================
//         // PRODUCT UPDATE
//         // ==========================================

//         if (product !== undefined) {

//             const productExists =
//                 await Product.findById(
//                     product
//                 );


//             if (!productExists) {

//                 return res.status(404).json({

//                     success: false,

//                     message:
//                         "Product not found"

//                 });

//             }


//             // If variant is also being updated,
//             // validate it against new product

//             const selectedVariantId =
//                 variantId !== undefined
//                     ? variantId
//                     : item.variantId;


//             const variantExists =
//                 productExists.variants?.some(
//                     variant =>
//                         String(variant._id) ===
//                         String(selectedVariantId)
//                 );


//             if (!variantExists) {

//                 return res.status(404).json({

//                     success: false,

//                     message:
//                         "Variant not found in selected product"

//                 });

//             }


//             item.product =
//                 product;

//         }


//         // ==========================================
//         // VARIANT UPDATE
//         // ==========================================

//         if (variantId !== undefined) {

//             const productId =
//                 product !== undefined
//                     ? product
//                     : item.product;


//             const productExists =
//                 await Product.findById(
//                     productId
//                 );


//             if (!productExists) {

//                 return res.status(404).json({

//                     success: false,

//                     message:
//                         "Product not found"

//                 });

//             }


//             const variantExists =
//                 productExists.variants?.some(
//                     variant =>
//                         String(variant._id) ===
//                         String(variantId)
//                 );


//             if (!variantExists) {

//                 return res.status(404).json({

//                     success: false,

//                     message:
//                         "Variant not found in selected product"

//                 });

//             }


//             item.variantId =
//                 variantId;

//         }


//         // ==========================================
//         // QUANTITY UPDATE
//         // ==========================================

//         if (quantity !== undefined) {

//             const newQuantity =
//                 Number(quantity);


//             if (
//                 !Number.isFinite(newQuantity) ||
//                 newQuantity < 1
//             ) {

//                 return res.status(400).json({

//                     success: false,

//                     message:
//                         "Quantity must be at least 1"

//                 });

//             }


//             // --------------------------------------
//             // Calculate already sold quantity
//             // --------------------------------------

//             const currentQuantity =
//                 Number(item.quantity) || 0;

//             const currentAvailable =
//                 Number(item.availableQuantity) || 0;


//             const soldQuantity =
//                 Math.max(
//                     currentQuantity -
//                     currentAvailable,
//                     0
//                 );


//             // --------------------------------------
//             // New quantity cannot be less than
//             // already sold quantity
//             // --------------------------------------

//             if (
//                 newQuantity <
//                 soldQuantity
//             ) {

//                 return res.status(400).json({

//                     success: false,

//                     message:
//                         `Quantity cannot be less than sold quantity (${soldQuantity})`

//                 });

//             }


//             // --------------------------------------
//             // Update quantity
//             // --------------------------------------

//             item.quantity =
//                 newQuantity;


//             // --------------------------------------
//             // Recalculate available quantity
//             // --------------------------------------

//             item.availableQuantity =
//                 newQuantity -
//                 soldQuantity;

//         }


//         // ==========================================
//         // PURCHASE PRICE
//         // ==========================================

//         if (purchasePrice !== undefined) {

//             const newPurchasePrice =
//                 Number(purchasePrice);


//             if (
//                 !Number.isFinite(
//                     newPurchasePrice
//                 ) ||
//                 newPurchasePrice < 0
//             ) {

//                 return res.status(400).json({

//                     success: false,

//                     message:
//                         "Valid purchase price is required"

//                 });

//             }


//             item.purchasePrice =
//                 newPurchasePrice;

//         }


//         // ==========================================
//         // SUPPLIER PRODUCT CODE
//         // ==========================================

//         if (
//             supplierProductCode !== undefined
//         ) {

//             item.supplierProductCode =
//                 supplierProductCode;

//         }


//         // ==========================================
//         // BATCH NUMBER
//         // ==========================================

//         if (
//             batchNumber !== undefined
//         ) {

//             item.batchNumber =
//                 batchNumber;

//         }


//         // ==========================================
//         // DISCOUNT
//         // ==========================================

//         if (
//             discount !== undefined
//         ) {

//             const newDiscount =
//                 Number(discount);


//             if (
//                 !Number.isFinite(newDiscount) ||
//                 newDiscount < 0
//             ) {

//                 return res.status(400).json({

//                     success: false,

//                     message:
//                         "Discount must be 0 or greater"

//                 });

//             }


//             item.discount =
//                 newDiscount;

//         }


//         // ==========================================
//         // TAX
//         // ==========================================

//         if (
//             tax !== undefined
//         ) {

//             const newTax =
//                 Number(tax);


//             if (
//                 !Number.isFinite(newTax) ||
//                 newTax < 0
//             ) {

//                 return res.status(400).json({

//                     success: false,

//                     message:
//                         "Tax must be 0 or greater"

//                 });

//             }


//             item.tax =
//                 newTax;

//         }


//         // ==========================================
//         // TOTAL AMOUNT
//         // ==========================================

//         if (
//             totalAmount !== undefined
//         ) {

//             const newTotalAmount =
//                 Number(totalAmount);


//             if (
//                 !Number.isFinite(
//                     newTotalAmount
//                 ) ||
//                 newTotalAmount < 0
//             ) {

//                 return res.status(400).json({

//                     success: false,

//                     message:
//                         "Total amount must be 0 or greater"

//                 });

//             }


//             item.totalAmount =
//                 newTotalAmount;

//         }


//         // ==========================================
//         // NOTES
//         // ==========================================

//         if (
//             notes !== undefined
//         ) {

//             item.notes =
//                 notes?.trim() || "";

//         }


//         // ==========================================
//         // SAVE
//         // ==========================================

//         console.log(
//             "ITEM BEFORE SAVE:",
//             item.toObject()
//         );


//         await item.save();


//         console.log(
//             "ITEM AFTER SAVE:",
//             item.toObject()
//         );


//         // ==========================================
//         // POPULATE
//         // ==========================================

//         await item.populate([

//             {
//                 path: "purchase",

//                 populate: {
//                     path: "supplier"
//                 }

//             },

//             {
//                 path: "product"

//             }

//         ]);


//         // ==========================================
//         // SUCCESS
//         // ==========================================

//         return res.status(200).json({

//             success: true,

//             message:
//                 "Supplier purchase item updated successfully",

//             data:
//                 item

//         });

//     }


//     catch (error) {

//         console.log(
//             "Update Supplier Purchase Item Error:",
//             error
//         );


//         return res.status(500).json({

//             success: false,

//             message:
//                 error.message

//         });

//     }

// };

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
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


        // =====================================================
        // BASIC VALIDATION
        // =====================================================

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
                message: "Product variant is required"
            });

        }


        // =====================================================
        // QUANTITY VALIDATION
        // =====================================================

        const purchaseQuantity = Number(quantity);

        if (
            !Number.isFinite(purchaseQuantity) ||
            purchaseQuantity < 1
        ) {

            return res.status(400).json({
                success: false,
                message: "Valid quantity is required"
            });

        }


        // =====================================================
        // PURCHASE PRICE VALIDATION
        // =====================================================

        const price = Number(purchasePrice);

        if (
            !Number.isFinite(price) ||
            price < 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Valid purchase price is required"
            });

        }


        // =====================================================
        // DISCOUNT VALIDATION
        // =====================================================

        const discountAmount = Number(discount) || 0;

        if (discountAmount < 0) {

            return res.status(400).json({
                success: false,
                message: "Discount cannot be negative"
            });

        }


        // =====================================================
        // TAX VALIDATION
        // =====================================================

        const taxPercentage = Number(tax) || 0;

        if (taxPercentage < 0) {

            return res.status(400).json({
                success: false,
                message: "Tax cannot be negative"
            });

        }


        // =====================================================
        // TOTAL AMOUNT
        // =====================================================

        const itemTotalAmount = Number(totalAmount);

        if (
            !Number.isFinite(itemTotalAmount) ||
            itemTotalAmount < 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Valid total amount is required"
            });

        }


        // =====================================================
        // CHECK SUPPLIER PURCHASE
        // =====================================================

        const existingPurchase =
            await SupplierPurchase.findById(purchase);

        if (!existingPurchase) {

            return res.status(404).json({
                success: false,
                message: "Supplier purchase not found"
            });

        }


        // =====================================================
        // CHECK PRODUCT
        // =====================================================

        const existingProduct =
            await Product.findById(product);

        if (!existingProduct) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });

        }


        // =====================================================
        // CHECK VARIANT
        // =====================================================

        const selectedVariant =
            existingProduct.variants?.find(

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
        // Same product + same variant should not be added
        // twice to the SAME invoice.
        //
        // Example:
        //
        // Invoice INV-1001
        //
        // Gold Ring / SKU-001  -> already exists
        //
        // Adding Gold Ring / SKU-001 again
        // should be rejected.
        //
        // =====================================================

        const existingItem =
            await SupplierPurchaseItem.findOne({

                purchase: purchase,
                product: product,
                variantId: variantId

            });


        if (existingItem) {

            return res.status(400).json({

                success: false,

                message:
                    "This product variant is already added to this purchase"

            });

        }


        // =====================================================
        // AVAILABLE QUANTITY
        // =====================================================
        //
        // Initially:
        //
        // quantity = 10
        // availableQuantity = 10
        //
        // Later sales/stock consumption can reduce
        // availableQuantity.
        //
        // =====================================================

        const availableQuantity =
            purchaseQuantity;


        // =====================================================
        // CREATE SUPPLIER PURCHASE ITEM
        // =====================================================

        const item =
            await SupplierPurchaseItem.create({

                purchase: purchase,

                product: product,

                variantId: variantId,

                quantity: purchaseQuantity,

                availableQuantity: availableQuantity,

                purchasePrice: price,

                supplierProductCode:
                    supplierProductCode?.trim() || "",

                batchNumber:
                    batchNumber?.trim() || "",

                discount:
                    discountAmount,

                tax:
                    taxPercentage,

                totalAmount:
                    itemTotalAmount,

                notes:
                    notes?.trim() || ""

            });


        // =====================================================
        // POPULATE PURCHASE + SUPPLIER + PRODUCT
        // =====================================================

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


        // =====================================================
        // SUCCESS RESPONSE
        // =====================================================

        return res.status(201).json({

            success: true,

            message:
                "Supplier purchase item created successfully",

            data: item

        });

    }


    catch (error) {

        console.log(
            "Create Supplier Purchase Item Error:",
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

// =====================================================
// GET ITEMS BY PURCHASE
// =====================================================

exports.getPurchaseItemsByPurchase = async (
    req,
    res
) => {

    try {

        const { purchaseId } = req.params;


        // =====================================================
        // VALIDATE PURCHASE
        // =====================================================

        const purchase =
            await SupplierPurchase.findById(
                purchaseId
            ).populate("supplier");


        if (!purchase) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        // =====================================================
        // GET ALL ITEMS FOR THIS PURCHASE
        // =====================================================

        const items =
            await SupplierPurchaseItem
                .find({
                    purchase: purchaseId
                })
                .populate({
                    path: "product"
                })
                .sort({
                    createdAt: 1
                });


        // =====================================================
        // ADD SELECTED VARIANT DETAILS
        // =====================================================
        //
        // variantId Product schema lo embedded variant.
        // Kabatti variantId ni populate cheyyalem.
        //
        // Product.variants[] nundi exact variant ni find chestham.
        //
        // =====================================================

        const formattedItems =
            items.map(item => {

                const itemObject =
                    item.toObject();


                const selectedVariant =
                    itemObject.product?.variants?.find(

                        variant =>
                            String(variant._id) ===
                            String(itemObject.variantId)

                    );


                return {

                    ...itemObject,

                    variant:
                        selectedVariant || null

                };

            });


        // =====================================================
        // SUCCESS RESPONSE
        // =====================================================

        return res.status(200).json({

            success: true,

            purchase: {

                _id:
                    purchase._id,

                supplier:
                    purchase.supplier,

                invoiceNumber:
                    purchase.invoiceNumber,

                invoiceDate:
                    purchase.invoiceDate,

                purchaseDate:
                    purchase.purchaseDate,

                subtotal:
                    purchase.subtotal,

                discount:
                    purchase.discount,

                tax:
                    purchase.tax,

                totalAmount:
                    purchase.totalAmount,

                paymentStatus:
                    purchase.paymentStatus,

                status:
                    purchase.status

            },

            count:
                formattedItems.length,

            data:
                formattedItems

        });

    }


    catch (error) {

        console.log(
            "Get Purchase Items By Purchase Error:",
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

    try {

        const { id } = req.params;

        const {
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


        // =====================================================
        // FIND ITEM
        // =====================================================

        const item =
            await SupplierPurchaseItem.findById(id);


        if (!item) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase item not found"

            });

        }


        // =====================================================
        // CHECK PURCHASE
        // =====================================================

        const purchaseExists =
            await SupplierPurchase.findById(
                item.purchase
            );


        if (!purchaseExists) {

            return res.status(404).json({

                success: false,

                message:
                    "Supplier purchase not found"

            });

        }


        // =====================================================
        // DETERMINE PRODUCT + VARIANT
        // =====================================================

        const selectedProductId =
            product !== undefined
                ? product
                : item.product;

        const selectedVariantId =
            variantId !== undefined
                ? variantId
                : item.variantId;


        // =====================================================
        // PRODUCT UPDATE / VALIDATION
        // =====================================================

        const existingProduct =
            await Product.findById(
                selectedProductId
            );


        if (!existingProduct) {

            return res.status(404).json({

                success: false,

                message:
                    "Product not found"

            });

        }


        // =====================================================
        // VARIANT VALIDATION
        // =====================================================

        const selectedVariant =
            existingProduct.variants?.find(

                variant =>
                    String(variant._id) ===
                    String(selectedVariantId)

            );


        if (!selectedVariant) {

            return res.status(404).json({

                success: false,

                message:
                    "Variant not found in selected product"

            });

        }


        // =====================================================
        // DUPLICATE PRODUCT + VARIANT CHECK
        // =====================================================
        //
        // Same product + same variant should not exist
        // twice inside the SAME purchase/invoice.
        //
        // We exclude the current item using _id.
        //
        // =====================================================

        const duplicateItem =
            await SupplierPurchaseItem.findOne({

                purchase: item.purchase,

                product: selectedProductId,

                variantId: selectedVariantId,

                _id: {
                    $ne: item._id
                }

            });


        if (duplicateItem) {

            return res.status(400).json({

                success: false,

                message:
                    "This product variant is already added to this purchase"

            });

        }


        // =====================================================
        // UPDATE PRODUCT
        // =====================================================

        if (product !== undefined) {

            item.product =
                selectedProductId;

        }


        // =====================================================
        // UPDATE VARIANT
        // =====================================================

        if (variantId !== undefined) {

            item.variantId =
                selectedVariantId;

        }


        // =====================================================
        // QUANTITY UPDATE
        // =====================================================

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


            // Current purchase quantity
            const currentQuantity =
                Number(item.quantity) || 0;


            // Current available quantity
            const currentAvailable =
                Number(item.availableQuantity) || 0;


            // Already sold/consumed quantity
            const soldQuantity =
                Math.max(
                    currentQuantity -
                    currentAvailable,
                    0
                );


            // Cannot reduce quantity below
            // already sold quantity
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


            item.quantity =
                newQuantity;


            // Preserve already sold quantity
            item.availableQuantity =
                newQuantity -
                soldQuantity;

        }


        // =====================================================
        // PURCHASE PRICE UPDATE
        // =====================================================

        if (purchasePrice !== undefined) {

            const newPurchasePrice =
                Number(purchasePrice);


            if (
                !Number.isFinite(newPurchasePrice) ||
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


        // =====================================================
        // SUPPLIER PRODUCT CODE
        // =====================================================

        if (
            supplierProductCode !== undefined
        ) {

            item.supplierProductCode =
                supplierProductCode?.trim() || "";

        }


        // =====================================================
        // BATCH NUMBER
        // =====================================================

        if (
            batchNumber !== undefined
        ) {

            item.batchNumber =
                batchNumber?.trim() || "";

        }


        // =====================================================
        // DISCOUNT UPDATE
        // =====================================================

        if (discount !== undefined) {

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


        // =====================================================
        // TAX UPDATE
        // =====================================================

        if (tax !== undefined) {

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


        // =====================================================
        // TOTAL AMOUNT UPDATE
        // =====================================================

        if (totalAmount !== undefined) {

            const newTotalAmount =
                Number(totalAmount);


            if (
                !Number.isFinite(newTotalAmount) ||
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


        // =====================================================
        // NOTES
        // =====================================================

        if (notes !== undefined) {

            item.notes =
                notes?.trim() || "";

        }


        // =====================================================
        // SAVE
        // =====================================================

        await item.save();


        // =====================================================
        // POPULATE
        // =====================================================

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


        // =====================================================
        // SUCCESS
        // =====================================================

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
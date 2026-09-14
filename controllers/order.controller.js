const mongoose = require("mongoose");
const Order = require("../models/order");
const Product = require("../models/product");
const User = require("../models/user-login");
const Address = require("../models/address");
const Admin = require("../models/user");
const { sendInvoiceEmail } = require("../middleware/mail");
const SupplierPurchaseItem = require("../models/supplier-purchase-items");
const MakerProductionItem = require("../models/maker-production-item");

const calculateVariantPrice = require("../utils/price-calculator");

// ======================================================
// CREATE ORDER
// ======================================================

exports.createOrder = async (req, res) => {

    const session = await mongoose.startSession();

    session.startTransaction();

    try {

        // ==================================================
        // 1. BASIC VALIDATION
        // ==================================================

        const {
            orderSource,
            user: userId,
            address: addressId,
            items,
            paymentMethod,

            branch,
            subBranch,
            createdBy,

            customerDetails,

            discountAmount = 0,
            couponCode = "",
            shippingCharge = 0,
            gstAmount = 0
        } = req.body;


        if (!orderSource) {
            throw new Error("Order source is required");
        }

        if (
            !["ONLINE", "BRANCH", "SUB_BRANCH"]
                .includes(orderSource)
        ) {
            throw new Error("Invalid order source");
        }


        if (!paymentMethod) {
            throw new Error("Payment method is required");
        }


        if (!items) {
            throw new Error("Order items are required");
        }


        // ==================================================
        // 2. PARSE ITEMS
        // ==================================================

        let parsedItems = items;

        if (typeof items === "string") {
            try {
                parsedItems = JSON.parse(items);
            } catch (error) {
                throw new Error("Invalid items JSON");
            }
        }


        if (
            !Array.isArray(parsedItems) ||
            parsedItems.length === 0
        ) {
            throw new Error(
                "At least one order item is required"
            );
        }


        // ==================================================
        // 3. CUSTOMER VALIDATION
        // ==================================================

        let user = null;
        let address = null;


        if (orderSource === "ONLINE") {

            if (!userId) {
                throw new Error(
                    "User is required for online order"
                );
            }

            if (!addressId) {
                throw new Error(
                    "Address is required for online order"
                );
            }


            user = await User.findById(userId)
                .session(session);

            if (!user) {
                throw new Error("User not found");
            }


            address = await Address.findById(addressId)
                .session(session);

            if (!address) {
                throw new Error("Address not found");
            }
        }


        // ==================================================
        // 4. BRANCH / SUB-BRANCH VALIDATION
        // ==================================================

        let branchAdmin = null;
        let subBranchAdmin = null;
        let createdByAdmin = null;


        if (orderSource === "BRANCH") {

            if (!branch) {
                throw new Error(
                    "Branch is required"
                );
            }

            branchAdmin = await Admin.findById(branch)
                .session(session);

            if (!branchAdmin) {
                throw new Error(
                    "Branch admin not found"
                );
            }
        }


        if (orderSource === "SUB_BRANCH") {

            if (!subBranch) {
                throw new Error(
                    "Sub branch is required"
                );
            }

            subBranchAdmin = await Admin.findById(subBranch)
                .session(session);

            if (!subBranchAdmin) {
                throw new Error(
                    "Sub branch admin not found"
                );
            }
        }


        if (createdBy) {

            createdByAdmin = await Admin.findById(createdBy)
                .session(session);

            if (!createdByAdmin) {
                throw new Error(
                    "Created by admin not found"
                );
            }
        }


        // ==================================================
        // 5. GENERATE ORDER NUMBER
        // ==================================================

        const timestamp = Date.now();

        const orderNumber =
            `ORD-${timestamp}`;


        const invoiceNumber =
            `INV-${timestamp}`;


        // ==================================================
        // 6. ADDRESS SNAPSHOT
        // ==================================================

        let addressSnapshot = null;

        if (address) {

            addressSnapshot = {

                fullName: address.fullName,

                phone: address.phone,

                alternatePhone:
                    address.alternatePhone,

                addressLine1:
                    address.addressLine1,

                addressLine2:
                    address.addressLine2,

                landmark:
                    address.landmark,

                city:
                    address.city,

                state:
                    address.state,

                country:
                    address.country,

                postalCode:
                    address.postalCode
            };
        }


        // ==================================================
        // 7. PREPARE ORDER ITEMS
        // ==================================================

        const orderItems = [];


        let subTotal = 0;
        let totalDiscount = Number(discountAmount) || 0;
        let totalGst = Number(gstAmount) || 0;


        // ==================================================
        // 8. PROCESS EVERY ITEM
        // ==================================================

        for (const item of parsedItems) {

            if (!item.product) {
                throw new Error(
                    "Product is required"
                );
            }

            if (!item.variant) {
                throw new Error(
                    "Variant is required"
                );
            }


            const quantity =
                Number(item.quantity) || 1;


            if (quantity <= 0) {
                throw new Error(
                    "Quantity must be greater than zero"
                );
            }


            // ==============================================
            // LOAD PRODUCT
            // ==============================================

            const product =
                await Product.findById(item.product)
                    .session(session);


            if (!product) {
                throw new Error(
                    `Product not found: ${item.product}`
                );
            }


            // ==============================================
            // FIND EMBEDDED VARIANT
            // ==============================================

            const variant =
                product.variants.find(
                    v =>
                        v._id.toString() ===
                        item.variant.toString()
                );


            if (!variant) {
                throw new Error(
                    `Variant not found for product ${product.name}`
                );
            }


            // ==============================================
            // PRODUCT STOCK CHECK
            // ==============================================

            if (
                Number(variant.stock) <
                quantity
            ) {
                throw new Error(
                    `Insufficient stock for ${product.name}`
                );
            }


            // ==============================================
            // CALCULATE PRICE
            // ==============================================

            const priceDetails =
                await calculateVariantPrice(variant);


            if (!priceDetails) {
                throw new Error(
                    `Unable to calculate price for ${product.name}`
                );
            }


            const unitPrice =
                Number(
                    priceDetails.finalPrice
                ) || 0;


            const totalPrice =
                unitPrice * quantity;


            // ==============================================
            // STONE WEIGHT
            // ==============================================

            const stoneWeight =
                variant.stones?.reduce(
                    (total, stone) =>
                        total +
                        (
                            Number(stone.totalWeight) ||
                            0
                        ),
                    0
                ) || 0;


            // ==============================================
            // DIAMOND WEIGHT
            // ==============================================

            const diamondWeight =
                variant.stones
                    ?.filter(
                        stone =>
                            stone.stoneType ===
                            "diamond"
                    )
                    .reduce(
                        (total, stone) =>
                            total +
                            (
                                Number(
                                    stone.totalWeight
                                ) || 0
                            ),
                        0
                    ) || 0;


            // ==============================================
            // PRODUCT SNAPSHOT
            // ==============================================

            const productSnapshot = {

                name: product.name,

                slug: product.slug,

                image:
                    product.images?.[0] || null,

                category:
                    product.category?.toString() ||
                    null,

                subCategory:
                    product.subCategory?.toString() ||
                    null,

                subSubCategory:
                    product.subSubCategory?.toString() ||
                    null,

                productType:
                    product.productType,

                brand:
                    product.brand || ""
            };


            // ==============================================
            // STONES SNAPSHOT
            // ==============================================

            const stonesSnapshot =
                variant.stones?.map(stone => ({

                    stoneType:
                        stone.stoneType,

                    stoneCategory:
                        stone.stoneCategory,

                    quality:
                        stone.quality,

                    quantity:
                        Number(stone.quantity) || 0,

                    totalWeight:
                        Number(
                            stone.totalWeight
                        ) || 0,

                    // Calculator may return stone value
                    stoneValue:
                        Number(
                            stone.stoneValue
                        ) || 0

                })) || [];


            // ==============================================
            // VARIANT SNAPSHOT
            // ==============================================

            const variantSnapshot = {

                sku:
                    variant.sku,

                metalType:
                    variant.metalType,

                purity:
                    variant.metalPurity,

                metalColor:
                    variant.metalColor,

                size:
                    variant.size,

                grossWeight:
                    Number(
                        variant.grossWeight
                    ) || 0,

                netWeight:
                    Number(
                        variant.netWeight
                    ) || 0,

                wastagePercentage:
                    Number(
                        variant.wastagePercentage
                    ) || 0,

                stoneWeight,

                diamondWeight,

                makingCharge:
                    Number(
                        variant.makingCharges
                    ) || 0,

                makingChargeType:
                    variant.makingChargeType,

                discountPercentage:
                    Number(
                        variant.discountPercentage
                    ) || 0,

                stoneType:
                    stonesSnapshot?.[0]?.stoneType ||
                    null,

                gender:
                    product.gender || null,

                stones:
                    stonesSnapshot
            };


            // ==============================================
            // PRICING SNAPSHOT
            // ==============================================

            const pricingSnapshot = {

                goldRate:
                    Number(
                        priceDetails.goldRate
                    ) || 0,

                goldValue:
                    Number(
                        priceDetails.goldValue
                    ) || 0,

                wastageAmount:
                    Number(
                        priceDetails.wastageAmount
                    ) || 0,

                stoneValue:
                    Number(
                        priceDetails.stoneValue
                    ) || 0,

                diamondValue:
                    Number(
                        priceDetails.diamondValue
                    ) || 0,

                makingCharge:
                    Number(
                        priceDetails.makingCharge
                    ) || 0,

                discountAmount:
                    Number(
                        priceDetails.discountAmount
                    ) || 0,

                gstPercentage:
                    Number(
                        priceDetails.gstPercentage
                    ) || 0,

                gstAmount:
                    Number(
                        priceDetails.gstAmount
                    ) || 0,

                finalPrice:
                    unitPrice
            };


            // ==============================================
            // SOURCE STOCK ALLOCATION
            // ==============================================
            //
            // FIFO:
            // Oldest available stock first.
            //
            // Supplier purchase date / maker production
            // issue date based ordering can be applied here.

            let remainingQuantity =
                quantity;


            const stockAllocations = [];


            // ==============================================
            // SUPPLIER STOCK
            // ==============================================

            const supplierItems =
                await SupplierPurchaseItem
                    .find({
                        product: product._id,

                        variantId: variant._id,

                        availableQuantity: {
                            $gt: 0
                        }
                    })
                    .populate({
                        path: "purchase",
                        select: "purchaseDate invoiceNumber"
                    })
                    .sort({
                        createdAt: 1
                    })
                    .session(session);


            for (
                const supplierItem
                of supplierItems
            ) {

                if (remainingQuantity <= 0) {
                    break;
                }


                const available =
                    Number(
                        supplierItem.availableQuantity
                    ) || 0;


                if (available <= 0) {
                    continue;
                }


                const allocateQuantity =
                    Math.min(
                        remainingQuantity,
                        available
                    );


                supplierItem.availableQuantity =
                    available -
                    allocateQuantity;


                await supplierItem.save({
                    session
                });


                stockAllocations.push({

                    sourceType:
                        "SUPPLIER",

                    supplierPurchaseItem:
                        supplierItem._id,

                    makerProductionItem:
                        null,

                    quantity:
                        allocateQuantity
                });


                remainingQuantity -=
                    allocateQuantity;
            }


            // ==============================================
            // MAKER STOCK
            // ==============================================

            if (remainingQuantity > 0) {

                const makerItems =
                    await MakerProductionItem
                        .find({
                            product: product._id,

                            variantId: variant._id,

                            availableQuantity: {
                                $gt: 0
                            }
                        })
                        .populate({
                            path: "production",
                            select:
                                "issueDate productionNumber"
                        })
                        .sort({
                            createdAt: 1
                        })
                        .session(session);


                for (
                    const makerItem
                    of makerItems
                ) {

                    if (
                        remainingQuantity <= 0
                    ) {
                        break;
                    }


                    const available =
                        Number(
                            makerItem.availableQuantity
                        ) || 0;


                    if (available <= 0) {
                        continue;
                    }


                    const allocateQuantity =
                        Math.min(
                            remainingQuantity,
                            available
                        );


                    makerItem.availableQuantity =
                        available -
                        allocateQuantity;


                    await makerItem.save({
                        session
                    });


                    stockAllocations.push({

                        sourceType:
                            "MAKER",

                        supplierPurchaseItem:
                            null,

                        makerProductionItem:
                            makerItem._id,

                        quantity:
                            allocateQuantity
                    });


                    remainingQuantity -=
                        allocateQuantity;
                }
            }


            // ==============================================
            // FINAL SOURCE STOCK VALIDATION
            // ==============================================

            if (remainingQuantity > 0) {

                throw new Error(
                    `Source stock unavailable for ${product.name} - SKU ${variant.sku}`
                );
            }


            // ==============================================
            // DECREASE PRODUCT AGGREGATE STOCK
            // ==============================================

            variant.stock =
                Number(variant.stock) -
                quantity;


            if (variant.stock < 0) {

                throw new Error(
                    `Invalid stock calculation for ${product.name}`
                );
            }


            await product.save({
                session
            });


            // ==============================================
            // CREATE ORDER ITEM
            // ==============================================

            orderItems.push({

                product:
                    product._id,

                variant:
                    variant._id,

                productSnapshot,

                stockAllocations,

                variantSnapshot,

                pricingSnapshot,

                quantity,

                unitPrice,

                totalPrice
            });


            // ==============================================
            // TOTALS
            // ==============================================

            subTotal += totalPrice;

            totalGst +=
                Number(
                    priceDetails.gstAmount
                ) *
                quantity;
        }


        // ==================================================
        // 9. CALCULATE FINAL TOTAL
        // ==================================================

        const finalTotal =
            subTotal
            - totalDiscount
            + Number(shippingCharge || 0)
            + totalGst;


        if (finalTotal < 0) {

            throw new Error(
                "Invalid order total"
            );
        }


        // ==================================================
        // 10. PAYMENT STATUS
        // ==================================================

        let paymentStatus = "Pending";

        if (
            paymentMethod === "CASH" ||
            paymentMethod === "UPI" ||
            paymentMethod === "CARD" ||
            paymentMethod === "ONLINE" ||
            paymentMethod === "NETBANKING"
        ) {
            paymentStatus = "Paid";
        }

        if (
            paymentMethod === "COD"
        ) {
            paymentStatus = "Pending";
        }


        // ==================================================
        // 11. ORDER STATUS
        // ==================================================

        const orderStatus =
            "Confirmed";


        // ==================================================
        // 12. CUSTOMER DETAILS
        // ==================================================

        let finalCustomerDetails =
            customerDetails || {};


        if (user) {

            finalCustomerDetails = {

                name:
                    customerDetails?.name ||
                    user.name ||
                    "",

                phone:
                    customerDetails?.phone ||
                    user.phone ||
                    "",

                email:
                    customerDetails?.email ||
                    user.email ||
                    ""
            };
        }


        // ==================================================
        // 13. CREATE ORDER
        // ==================================================

        const order =
            new Order({

                orderNumber,

                invoiceNumber,

                orderSource,

                branch:
                    branch || null,

                subBranch:
                    subBranch || null,

                createdBy:
                    createdBy || null,

                user:
                    user?._id || null,

                customerDetails:
                    finalCustomerDetails,

                items:
                    orderItems,

                address:
                    address?._id || null,

                addressSnapshot,

                paymentMethod,

                paymentStatus,

                subTotal,

                discountAmount:
                    totalDiscount,

                couponCode,

                shippingCharge:
                    Number(shippingCharge) || 0,

                gstAmount:
                    totalGst,

                totalAmount:
                    finalTotal,

                orderStatus,

                billingStatus:
                    "Completed",

                statusHistory: [{

                    status:
                        orderStatus,

                    updatedBy:
                        createdBy || null,

                    remarks:
                        "Order created",

                    updatedAt:
                        new Date()
                }],

                invoiceDate:
                    new Date(),

                stockUpdated:
                    true

            });


        await order.save({
            session
        });


        // ==================================================
        // 14. COMMIT TRANSACTION
        // ==================================================

        await session.commitTransaction();

        session.endSession();


        // ==================================================
        // 15. SEND INVOICE EMAIL
        // ==================================================
        // Email fail ayina order rollback avvakudadhu.
        // Order already successfully created.

        if (
            user?.email &&
            orderSource === "ONLINE"
        ) {

            try {

                await sendInvoiceEmail(
                    user.email,
                    order
                );

            } catch (emailError) {

                console.error(
                    "Invoice email failed:",
                    emailError.message
                );
            }
        }


        // ==================================================
        // 16. RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            message:
                "Order created successfully",

            data:
                order

        });


    } catch (error) {

        // ==================================================
        // ROLLBACK
        // ==================================================

        await session.abortTransaction();

        session.endSession();


        console.error(
            "Create Order Error:",
            error
        );


        return res.status(400).json({

            success: false,

            message:
                error.message ||
                "Failed to create order"

        });
    }
};





exports.getAllOrders = async (req, res) => {
    try {

        // ==================================================
        // PAGINATION
        // ==================================================

        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;

        if (page < 1) page = 1;
        if (limit < 1) limit = 10;

        const skip = (page - 1) * limit;


        // ==================================================
        // SEARCH
        // ==================================================

        const search = req.query.search?.trim() || "";

        const query = {};

        if (search) {

            query.$or = [

                {
                    orderNumber: {
                        $regex: search,
                        $options: "i"
                    }
                },

                {
                    invoiceNumber: {
                        $regex: search,
                        $options: "i"
                    }
                },

                {
                    "customerDetails.name": {
                        $regex: search,
                        $options: "i"
                    }
                },

                {
                    "customerDetails.phone": {
                        $regex: search,
                        $options: "i"
                    }
                }
            ];
        }


        // ==================================================
        // OPTIONAL FILTERS
        // ==================================================

        if (req.query.orderStatus) {

            query.orderStatus =
                req.query.orderStatus;
        }


        if (req.query.paymentStatus) {

            query.paymentStatus =
                req.query.paymentStatus;
        }


        if (req.query.orderSource) {

            query.orderSource =
                req.query.orderSource;
        }


        // ==================================================
        // TOTAL COUNT
        // ==================================================

        const totalOrders =
            await Order.countDocuments(query);


        // ==================================================
        // GET ORDERS
        // ==================================================

        const orders =
            await Order.find(query)

                // ------------------------------------------
                // CUSTOMER
                // ------------------------------------------

                .populate({
                    path: "user",
                    select:
                        "name email phone"
                })

                // ------------------------------------------
                // BRANCH
                // ------------------------------------------

                .populate({
                    path: "branch",
                    select:
                        "name email phone role"
                })

                // ------------------------------------------
                // SUB BRANCH
                // ------------------------------------------

                .populate({
                    path: "subBranch",
                    select:
                        "name email phone role"
                })

                // ------------------------------------------
                // CREATED BY
                // ------------------------------------------

                .populate({
                    path: "createdBy",
                    select:
                        "name email phone role"
                })

                // ------------------------------------------
                // ADDRESS
                // ------------------------------------------

                .populate({
                    path: "address"
                })

                // ------------------------------------------
                // SUPPLIER PURCHASE ITEM
                // ------------------------------------------

                .populate({
                    path:
                        "items.stockAllocations.supplierPurchaseItem",

                    select:
                        "purchase supplierProductCode batchNumber quantity availableQuantity purchasePrice discount tax totalAmount notes",

                    populate: {

                        path: "purchase",

                        select:
                            "supplier invoiceNumber invoiceDate purchaseDate status paymentStatus",

                        populate: {

                            path: "supplier",

                            select:
                                "name companyName phone email gstNumber address"

                        }
                    }
                })

                // ------------------------------------------
                // MAKER PRODUCTION ITEM
                // ------------------------------------------

                .populate({
                    path:
                        "items.stockAllocations.makerProductionItem",

                    select:
                        "production quantityGiven quantityReceived availableQuantity notes",

                    populate: {

                        path: "production",

                        select:
                            "maker productionNumber issueDate expectedDate receivedDate status notes",

                        populate: {

                            path: "maker",

                            select:
                                "name phone email address specialization notes"

                        }
                    }
                })

                // ------------------------------------------
                // SORT
                // ------------------------------------------

                .sort({
                    createdAt: -1
                })

                // ------------------------------------------
                // PAGINATION
                // ------------------------------------------

                .skip(skip)
                .limit(limit);


        // ==================================================
        // FORMAT SOURCE INFORMATION
        // ==================================================
        //
        // Frontend ki direct ga:
        //
        // SUPPLIER
        // supplierDetails
        //
        // MAKER
        // makerDetails
        //
        // ani easy structure provide chestham.

        const formattedOrders =
            orders.map(order => {

                const orderObj =
                    order.toObject();


                orderObj.items =
                    orderObj.items.map(item => {

                        item.stockAllocations =
                            item.stockAllocations?.map(
                                allocation => {

                                    // ==================================
                                    // SUPPLIER SOURCE
                                    // ==================================

                                    if (
                                        allocation.sourceType ===
                                        "SUPPLIER"
                                    ) {

                                        const supplierItem =
                                            allocation
                                                .supplierPurchaseItem;


                                        const purchase =
                                            supplierItem?.purchase;


                                        const supplier =
                                            purchase?.supplier;


                                        return {

                                            ...allocation,

                                            sourceDetails: {

                                                sourceType:
                                                    "SUPPLIER",

                                                supplierPurchaseItemId:
                                                    supplierItem?._id ||
                                                    null,

                                                supplier: supplier
                                                    ? {
                                                        _id:
                                                            supplier._id,

                                                        name:
                                                            supplier.name,

                                                        companyName:
                                                            supplier.companyName,

                                                        phone:
                                                            supplier.phone,

                                                        email:
                                                            supplier.email,

                                                        gstNumber:
                                                            supplier.gstNumber,

                                                        address:
                                                            supplier.address
                                                    }
                                                    : null,

                                                purchase: purchase
                                                    ? {
                                                        _id:
                                                            purchase._id,

                                                        invoiceNumber:
                                                            purchase.invoiceNumber,

                                                        invoiceDate:
                                                            purchase.invoiceDate,

                                                        purchaseDate:
                                                            purchase.purchaseDate,

                                                        status:
                                                            purchase.status,

                                                        paymentStatus:
                                                            purchase.paymentStatus
                                                    }
                                                    : null,

                                                supplierProductCode:
                                                    supplierItem
                                                        ?.supplierProductCode ||
                                                    "",

                                                batchNumber:
                                                    supplierItem
                                                        ?.batchNumber ||
                                                    "",

                                                allocatedQuantity:
                                                    allocation.quantity
                                            }
                                        };
                                    }


                                    // ==================================
                                    // MAKER SOURCE
                                    // ==================================

                                    if (
                                        allocation.sourceType ===
                                        "MAKER"
                                    ) {

                                        const makerItem =
                                            allocation
                                                .makerProductionItem;


                                        const production =
                                            makerItem?.production;


                                        const maker =
                                            production?.maker;


                                        return {

                                            ...allocation,

                                            sourceDetails: {

                                                sourceType:
                                                    "MAKER",

                                                makerProductionItemId:
                                                    makerItem?._id ||
                                                    null,

                                                maker: maker
                                                    ? {
                                                        _id:
                                                            maker._id,

                                                        name:
                                                            maker.name,

                                                        phone:
                                                            maker.phone,

                                                        email:
                                                            maker.email,

                                                        specialization:
                                                            maker.specialization,

                                                        address:
                                                            maker.address
                                                    }
                                                    : null,

                                                production:
                                                    production
                                                        ? {
                                                            _id:
                                                                production._id,

                                                            productionNumber:
                                                                production.productionNumber,

                                                            issueDate:
                                                                production.issueDate,

                                                            expectedDate:
                                                                production.expectedDate,

                                                            receivedDate:
                                                                production.receivedDate,

                                                            status:
                                                                production.status
                                                        }
                                                        : null,

                                                allocatedQuantity:
                                                    allocation.quantity
                                            }
                                        };
                                    }


                                    return allocation;

                                }
                            );

                        return item;

                    });


                return orderObj;
            });


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                "Orders fetched successfully",

            data:
                formattedOrders,

            pagination: {

                currentPage:
                    page,

                totalPages:
                    Math.ceil(
                        totalOrders / limit
                    ),

                totalOrders,

                limit,

                hasNextPage:
                    page <
                    Math.ceil(
                        totalOrders / limit
                    ),

                hasPreviousPage:
                    page > 1
            }

        });

    } catch (error) {

        console.error(
            "Get All Orders Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to fetch orders"

        });
    }
};


// ======================================================
// GET ORDER BY ID
// ======================================================

exports.getOrderById = async (req, res) => {

    try {

        const { id } = req.params;


        // ==================================================
        // 1. VALIDATE ORDER ID
        // ==================================================

        if (!id) {

            return res.status(400).json({

                success: false,

                message: "Order ID is required"

            });
        }


        if (!mongoose.Types.ObjectId.isValid(id)) {

            return res.status(400).json({

                success: false,

                message: "Invalid order ID"

            });
        }


        // ==================================================
        // 2. GET ORDER
        // ==================================================

        const order = await Order.findById(id)

            // ------------------------------------------
            // CUSTOMER
            // ------------------------------------------

            .populate({
                path: "user",
                select: "name email phone"
            })

            // ------------------------------------------
            // BRANCH
            // ------------------------------------------

            .populate({
                path: "branch",
                select: "name email phone role"
            })

            // ------------------------------------------
            // SUB BRANCH
            // ------------------------------------------

            .populate({
                path: "subBranch",
                select: "name email phone role"
            })

            // ------------------------------------------
            // CREATED BY
            // ------------------------------------------

            .populate({
                path: "createdBy",
                select: "name email phone role"
            })

            // ------------------------------------------
            // ADDRESS
            // ------------------------------------------

            .populate({
                path: "address"
            })

            // ==================================================
            // SUPPLIER STOCK SOURCE
            // ==================================================

            .populate({
                path:
                    "items.stockAllocations.supplierPurchaseItem",

                select:
                    "purchase supplierProductCode batchNumber quantity availableQuantity purchasePrice discount tax totalAmount notes",

                populate: {

                    path: "purchase",

                    select:
                        "supplier invoiceNumber invoiceDate purchaseDate status paymentStatus",

                    populate: {

                        path: "supplier",

                        select:
                            "name companyName phone email gstNumber address"

                    }
                }
            })

            // ==================================================
            // MAKER STOCK SOURCE
            // ==================================================

            .populate({
                path:
                    "items.stockAllocations.makerProductionItem",

                select:
                    "production quantityGiven quantityReceived availableQuantity notes",

                populate: {

                    path: "production",

                    select:
                        "maker productionNumber issueDate expectedDate receivedDate status notes",

                    populate: {

                        path: "maker",

                        select:
                            "name phone email address specialization notes"

                    }
                }
            });


        // ==================================================
        // 3. ORDER NOT FOUND
        // ==================================================

        if (!order) {

            return res.status(404).json({

                success: false,

                message: "Order not found"

            });
        }


        // ==================================================
        // 4. CONVERT TO OBJECT
        // ==================================================

        const orderObj =
            order.toObject();


        // ==================================================
        // 5. FORMAT STOCK SOURCE INFORMATION
        // ==================================================

        orderObj.items =
            orderObj.items.map(item => {

                item.stockAllocations =
                    item.stockAllocations?.map(
                        allocation => {


                            // ==================================================
                            // SUPPLIER
                            // ==================================================

                            if (
                                allocation.sourceType ===
                                "SUPPLIER"
                            ) {

                                const supplierItem =
                                    allocation
                                        .supplierPurchaseItem;


                                const purchase =
                                    supplierItem?.purchase;


                                const supplier =
                                    purchase?.supplier;


                                return {

                                    ...allocation,

                                    sourceDetails: {

                                        sourceType:
                                            "SUPPLIER",


                                        supplierPurchaseItemId:
                                            supplierItem?._id ||
                                            null,


                                        // ----------------------------------
                                        // SUPPLIER DETAILS
                                        // ----------------------------------

                                        supplier:
                                            supplier
                                                ? {

                                                    _id:
                                                        supplier._id,

                                                    name:
                                                        supplier.name,

                                                    companyName:
                                                        supplier.companyName,

                                                    phone:
                                                        supplier.phone,

                                                    email:
                                                        supplier.email,

                                                    gstNumber:
                                                        supplier.gstNumber,

                                                    address:
                                                        supplier.address

                                                }
                                                : null,


                                        // ----------------------------------
                                        // PURCHASE DETAILS
                                        // ----------------------------------

                                        purchase:
                                            purchase
                                                ? {

                                                    _id:
                                                        purchase._id,

                                                    invoiceNumber:
                                                        purchase.invoiceNumber,

                                                    invoiceDate:
                                                        purchase.invoiceDate,

                                                    purchaseDate:
                                                        purchase.purchaseDate,

                                                    status:
                                                        purchase.status,

                                                    paymentStatus:
                                                        purchase.paymentStatus

                                                }
                                                : null,


                                        // ----------------------------------
                                        // SUPPLIER PRODUCT INFO
                                        // ----------------------------------

                                        supplierProductCode:
                                            supplierItem
                                                ?.supplierProductCode ||
                                            "",


                                        batchNumber:
                                            supplierItem
                                                ?.batchNumber ||
                                            "",


                                        // ----------------------------------
                                        // ORDER ALLOCATED QTY
                                        // ----------------------------------

                                        allocatedQuantity:
                                            allocation.quantity

                                    }

                                };

                            }


                            // ==================================================
                            // MAKER
                            // ==================================================

                            if (
                                allocation.sourceType ===
                                "MAKER"
                            ) {

                                const makerItem =
                                    allocation
                                        .makerProductionItem;


                                const production =
                                    makerItem?.production;


                                const maker =
                                    production?.maker;


                                return {

                                    ...allocation,

                                    sourceDetails: {

                                        sourceType:
                                            "MAKER",


                                        makerProductionItemId:
                                            makerItem?._id ||
                                            null,


                                        // ----------------------------------
                                        // MAKER DETAILS
                                        // ----------------------------------

                                        maker:
                                            maker
                                                ? {

                                                    _id:
                                                        maker._id,

                                                    name:
                                                        maker.name,

                                                    phone:
                                                        maker.phone,

                                                    email:
                                                        maker.email,

                                                    specialization:
                                                        maker.specialization,

                                                    address:
                                                        maker.address

                                                }
                                                : null,


                                        // ----------------------------------
                                        // PRODUCTION DETAILS
                                        // ----------------------------------

                                        production:
                                            production
                                                ? {

                                                    _id:
                                                        production._id,

                                                    productionNumber:
                                                        production.productionNumber,

                                                    issueDate:
                                                        production.issueDate,

                                                    expectedDate:
                                                        production.expectedDate,

                                                    receivedDate:
                                                        production.receivedDate,

                                                    status:
                                                        production.status,

                                                    notes:
                                                        production.notes

                                                }
                                                : null,


                                        // ----------------------------------
                                        // ORDER ALLOCATED QTY
                                        // ----------------------------------

                                        allocatedQuantity:
                                            allocation.quantity

                                    }

                                };

                            }


                            // ==================================================
                            // UNKNOWN SOURCE
                            // ==================================================

                            return allocation;

                        }
                    ) || [];


                return item;

            });


        // ==================================================
        // 6. RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                "Order fetched successfully",

            data:
                orderObj

        });


    } catch (error) {

        console.error(
            "Get Order By ID Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to fetch order"

        });

    }

};
// get order by user 

exports.getOrdersByUser = async (req, res) => {

    try {

        const { userId } = req.params;

        const orders = await Order.find({

            user: userId

        })

            .populate("user", "name phone email")

            .populate("address")

            .populate("statusHistory.updatedBy", "name role")

            .sort({ createdAt: -1 });

        if (!orders.length) {

            return res.status(404).json({

                success: false,

                message: "No orders found"

            });

        }

        res.status(200).json({

            success: true,

            count: orders.length,

            data: orders

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

// gey branch by order 
exports.getBranchOrders = async (req, res) => {

    try {

        const { branchId } = req.params;

        const orders = await Order.find({

            branch: branchId

        })

            .populate("branch", "name email contactNumber role")

            .populate("createdBy", "name email role")

            .populate("user", "name phone email")

            .populate("address")

            .populate("statusHistory.updatedBy", "name role")

            .sort({ createdAt: -1 });

        if (!orders.length) {

            return res.status(404).json({

                success: false,

                message: "No orders found"

            });

        }

        res.status(200).json({

            success: true,

            count: orders.length,

            data: orders

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

// get sub branch

exports.getSubBranchOrders = async (req, res) => {

    try {

        const { subBranchId } = req.params;

        const orders = await Order.find({

            subBranch: subBranchId

        })

            .populate("branch", "name email contactNumber role")

            .populate("subBranch", "name email contactNumber role")

            .populate("createdBy", "name email role")

            .populate("user", "name phone email")

            .populate("address")

            .populate("statusHistory.updatedBy", "name role")

            .sort({ createdAt: -1 });

        if (!orders.length) {

            return res.status(404).json({

                success: false,

                message: "No orders found"

            });

        }

        res.status(200).json({

            success: true,

            count: orders.length,

            data: orders

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

// calculate 
exports.calculatePrice = async (req, res) => {

    try {

        const { product, variant, quantity } = req.body;

        if (!product || !variant || !quantity) {

            return res.status(400).json({
                success: false,
                message: "Product, Variant and Quantity are required."
            });

        }

        const productData = await Product.findById(product);

        if (!productData) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }

        const variantData = productData.variants.id(variant);

        if (!variantData) {

            return res.status(404).json({
                success: false,
                message: "Variant not found."
            });

        }

        const price = await calculateVariantPrice(variantData);

        return res.status(200).json({

            success: true,

            data: {

                goldRate: price.metalRate,

                goldValue: price.metalValue,

                wastageAmount: price.wastageAmount,

                stoneValue: price.stoneValue,

                makingCharge: price.makingCharges,

                discountAmount: price.discountAmount,

                gstAmount: price.gstAmount,

                unitPrice: price.finalPrice,

                totalPrice: price.finalPrice * quantity

            }

        });

    }

    catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


exports.deleteOrder = async (req, res) => {
    try {

        const { id } = req.params;

        // Check Order
        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        // Delete Order
        await Order.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Order deleted successfully."
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

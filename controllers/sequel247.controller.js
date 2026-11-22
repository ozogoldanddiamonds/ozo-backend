const mongoose = require("mongoose");
const {
  searchPickupAddress,
  checkServiceability,
  createSequelShipment,
  trackSequelShipment,
  trackMultipleSequelShipments,
  cancelSequelShipment,
  downloadSequelPOD,
} = require("../service/sequel247.service");
const Order = require("../models/order");
const Product = require("../models/product");

// Verify OZO pickup address
exports.verifyPickupAddress = async (req, res) => {
  try {
    const result = await searchPickupAddress();

    if (String(result.status).toLowerCase() !== "true") {
      return res.status(400).json({
        success: false,
        message: result.message || "Pickup address verification failed",
        data: result,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pickup address verification completed",
      data: result.data,
    });
  } catch (error) {
    console.error("Sequel247 Pickup Verification:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Check customer delivery pincode
exports.checkDeliveryPincode = async (req, res) => {
  try {
    const { pincode } = req.body;

    if (!/^\d{6}$/.test(String(pincode || ""))) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 6-digit pincode",
      });
    }

    const result = await checkServiceability(pincode);

    return res.status(200).json({
      success: String(result.status).toLowerCase() === "true",
      message: result.message,
      data: result.data || null,
    });
  } catch (error) {
    console.error("Sequel247 Pincode Check:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to check delivery serviceability",
    });
  }
};

exports.saveShipmentPackages = async (req, res) => {
  try {
    const { id } = req.params;
    const { boxes } = req.body;

    // 1. Validate boxes
    if (!Array.isArray(boxes) || boxes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one package is required",
      });
    }

    // 2. Find order
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 3. Validate order eligibility
    if (
      order.orderSource !== "ONLINE" ||
      order.paymentMethod !== "ONLINE" ||
      order.paymentStatus !== "Paid"
    ) {
      return res.status(400).json({
        success: false,
        message: "Only paid online orders are eligible for shipment",
      });
    }

    // 4. Do not modify packages after booking starts
    if (["PENDING", "BOOKED"].includes(order.sequelShipment?.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: "Shipment is already booked or booking is in progress",
      });
    }

    // 5. Validate each package
    for (const [index, box] of boxes.entries()) {
      if (
        !box.boxNumber ||
        !box.lockNumber ||
        !Number.isFinite(Number(box.length)) ||
        !Number.isFinite(Number(box.breadth)) ||
        !Number.isFinite(Number(box.height)) ||
        !Number.isFinite(Number(box.grossWeight)) ||
        Number(box.length) <= 0 ||
        Number(box.breadth) <= 0 ||
        Number(box.height) <= 0 ||
        Number(box.grossWeight) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid package details at Box ${index + 1}`,
        });
      }
    }

    // 6. Map Angular boxes to MongoDB packages
    order.sequelShipment.packages = boxes.map((box) => ({
      boxNumber: String(box.boxNumber).trim(),
      lockNumber: String(box.lockNumber).trim(),
      length: Number(box.length),
      breadth: Number(box.breadth),
      height: Number(box.height),
      grossWeight: Number(box.grossWeight),
    }));

    order.sequelShipment.bookingStatus = "NOT_BOOKED";
    order.sequelShipment.bookingError = null;

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Package details saved successfully",
      data: order.sequelShipment,
    });
  } catch (error) {
    console.error("Save shipment packages error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save package details",
      error: error.message,
    });
  }
};

exports.bookSequelShipment = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch order and delivery address
    const order = await Order.findById(id).populate("address");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 2. Eligibility validation
    if (
      order.orderSource !== "ONLINE" ||
      order.paymentMethod !== "ONLINE" ||
      order.paymentStatus !== "Paid"
    ) {
      return res.status(400).json({
        success: false,
        message: "Only paid online orders are eligible",
      });
    }

    // 3. Existing shipment validation
    const currentStatus = order.sequelShipment?.bookingStatus || "NOT_BOOKED";

    // Already booked: return existing shipment details.
    // Never call Sequel247 again for a booked order.
    if (currentStatus === "BOOKED") {
      return res.status(200).json({
        success: true,
        message: "Shipment already booked",
        data: {
          orderNumber: order.orderNumber,
          bookingStatus: currentStatus,
          shipmentStatus: order.sequelShipment?.shipmentStatus,
          docketNumber: order.sequelShipment?.docketNumber,
          brn: order.sequelShipment?.brn,
          estimatedDelivery: order.sequelShipment?.estimatedDelivery,
          trackingLink: order.sequelShipment?.trackingLink || null,
          docketPrint: order.sequelShipment?.docketPrint || null,
          packages: order.sequelShipment?.packages || [],
        },
      });
    }

    // Pending means previous API request may still be processing
    // or its response may have been lost.
    if (currentStatus === "PENDING") {
      return res.status(409).json({
        success: false,
        message:
          "Shipment booking is pending verification. Please verify with Sequel247 before retrying.",
        bookingStatus: "PENDING",
      });
    }

    // Failed does not necessarily mean shipment was not created.
    // Require manual verification before allowing another attempt.
    // Failed booking can be retried only when the previous
    // shipment is confirmed cancelled or not created.
    if (currentStatus === "FAILED") {
      const previousShipmentStatus = String(
        order.sequelShipment?.shipmentStatus || "",
      ).toUpperCase();

      const previousDocket = order.sequelShipment?.docketNumber;

      if (previousDocket && previousShipmentStatus !== "SCANCELLED") {
        return res.status(409).json({
          success: false,
          message:
            "Previous shipment has a docket number. Verify its cancellation with Sequel247 before creating a new shipment.",
          bookingStatus: "FAILED",
          docketNumber: previousDocket,
        });
      }
    }
    // 4. Validate saved packages
    const packages = order.sequelShipment?.packages || [];

    if (!packages.length) {
      return res.status(400).json({
        success: false,
        message: "Please save package details first",
      });
    }

    // 5. Delivery address
    const address = order.addressSnapshot || {};
    const populatedAddress = order.address || {};

    const pincode = String(
      address.postalCode || populatedAddress.pincode || "",
    ).trim();

    const customerName = String(
      order.customerDetails?.name || address.fullName || "",
    ).trim();

    const customerPhone = String(
      order.customerDetails?.phone || address.phone || "",
    ).trim();

    const addressLine1 = cleanSequelAddress(address.addressLine1);

    const addressLine2 = cleanSequelAddress(address.addressLine2);

    if (!pincode || !customerName || !customerPhone || !addressLine1) {
      return res.status(400).json({
        success: false,
        message: "Customer delivery address details are incomplete",
      });
    }

    if (addressLine1.length > 50 || addressLine2.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Address lines must not exceed 50 characters",
      });
    }

    // 6. Validate destination serviceability
    const serviceability = await checkServiceability(pincode);

    if (String(serviceability?.status).toLowerCase() !== "true") {
      return res.status(400).json({
        success: false,
        message: "Destination pincode is not serviceable",
        data: serviceability,
      });
    }

    // 7. Calculate shipment weights in grams
    const netWeight = (order.items || []).reduce((total, item) => {
      return (
        total +
        Number(item.variantSnapshot?.netWeight || 0) *
          Number(item.quantity || 0)
      );
    }, 0);

    const grossWeight = packages.reduce((total, box) => {
      return total + Number(box.grossWeight || 0);
    }, 0);

    if (!Number.isFinite(netWeight) || netWeight < 1 || netWeight > 9999) {
      return res.status(400).json({
        success: false,
        message: "Shipment net weight must be between 1 and 9999 grams",
      });
    }

    if (!Number.isFinite(grossWeight) || grossWeight <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid total package gross weight",
      });
    }

    // 8. Validate every package
    for (const [index, box] of packages.entries()) {
      if (
        !box.boxNumber ||
        !box.lockNumber ||
        !Number.isFinite(Number(box.length)) ||
        Number(box.length) <= 0 ||
        !Number.isFinite(Number(box.breadth)) ||
        Number(box.breadth) <= 0 ||
        !Number.isFinite(Number(box.height)) ||
        Number(box.height) <= 0 ||
        !Number.isFinite(Number(box.grossWeight)) ||
        Number(box.grossWeight) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid package details for Box ${index + 1}`,
        });
      }
    }

    const currentAttempt = Number(order.sequelShipment?.bookingAttempt || 0);

    const nextAttempt = currentAttempt + 1;

    const bookingReference = `${order.orderNumber}-S${String(nextAttempt).padStart(2, "0")}`;

    const sequelBoxes = packages.map((box, index) => ({
      box_number: `${bookingReference}-B${String(index + 1).padStart(2, "0")}`,
      lock_number: String(box.lockNumber),
      length: String(box.length),
      breadth: String(box.breadth),
      height: String(box.height),
      gross_weight: String(box.grossWeight),
    }));

    // 10. Prepare shipment payload
    const payload = {
      location: "domestic",
      shipmentType: "D&J",
      serviceType: "valuable",
      fromStoreCode: process.env.SEQUEL247_PICKUP_STORE_CODE,

      toAddress: {
        consignee_name: customerName,
        address_line1: addressLine1,
        address_line2: addressLine2,
        pinCode: pincode,
        auth_receiver_name: customerName,
        auth_receiver_phone: customerPhone,
      },

      net_weight: String(netWeight),
      gross_weight: String(grossWeight),
      net_value: String(order.totalAmount),

      no_of_packages: String(sequelBoxes.length),
      boxes: sequelBoxes,

      invoice: [order.invoiceNumber || order.orderNumber],

      remark: "Handle with care",
    };

    // 11. Atomically lock booking
    // Only one request can move the order into PENDING.
    // 11. Atomically lock booking
    const lockedOrder = await Order.findOneAndUpdate(
      {
        _id: id,
        orderSource: "ONLINE",
        paymentMethod: "ONLINE",
        paymentStatus: "Paid",

        $or: [
          {
            "sequelShipment.bookingStatus": {
              $nin: ["PENDING", "BOOKED", "FAILED"],
            },
          },
          {
            "sequelShipment.bookingStatus": "FAILED",
            "sequelShipment.shipmentStatus": "SCANCELLED",
          },
        ],
      },
      {
        $set: {
          "sequelShipment.bookingStatus": "PENDING",
          "sequelShipment.bookingError": null,
          "sequelShipment.bookingAttempt": nextAttempt,
          "sequelShipment.bookingReference": bookingReference,
        },
      },
      {
        new: true,
      },
    );

    if (!lockedOrder) {
      return res.status(409).json({
        success: false,
        message:
          "Shipment booking already started or requires verification. Please refresh the order.",
      });
    }
    // 12. Call Sequel247
    let result;

    try {
      result = await createSequelShipment(payload);
    } catch (apiError) {
      // Do not mark FAILED on timeout/network errors.
      // Sequel247 may have created the shipment even if
      // our application did not receive the response.

      await Order.updateOne(
        {
          _id: id,
          "sequelShipment.bookingStatus": "PENDING",
        },
        {
          $set: {
            "sequelShipment.bookingError": `Sequel247 response uncertain: ${apiError.message}`,
          },
        },
      );

      return res.status(502).json({
        success: false,
        message:
          "Sequel247 response is uncertain. Verify shipment with Sequel247 before retrying.",
        bookingStatus: "PENDING",
      });
    }

    // 13. Read Sequel247 response
    const apiStatus = String(
      result?.status ?? result?.data?.status ?? "",
    ).toLowerCase();

    const shipmentData = result?.data?.data || result?.data || {};

    // 14. Handle API rejection
    if (apiStatus !== "true" || !shipmentData.docket_number) {
      const errorMessage =
        result?.message ||
        result?.data?.message ||
        "Sequel247 shipment creation failed";

      // Keep failed orders blocked from automatic retry.
      // Admin must verify whether Sequel247 created a shipment.
      await Order.updateOne(
        {
          _id: id,
          "sequelShipment.bookingStatus": "PENDING",
        },
        {
          $set: {
            "sequelShipment.bookingStatus": "FAILED",
            "sequelShipment.bookingError": errorMessage,
          },
        },
      );

      return res.status(400).json({
        success: false,
        message: errorMessage,
        data: result,
      });
    }

    // 15. Extract shipment details
    const docketNumber = shipmentData.docket_number;

    const brn = shipmentData.brn || null;

    const estimatedDelivery =
      shipmentData.estimated_delivery ||
      shipmentData.estiimated_delivery ||
      null;

    const trackingLink = shipmentData.tracking_link || null;

    const docketPrint = shipmentData.docket_print || null;

    // 16. Validate Sequel247 package response
    const sequelBoxDetails = Array.isArray(shipmentData.box_details)
      ? shipmentData.box_details
      : [];

    const packageCountMatches = sequelBoxDetails.length === packages.length;

    // Save barcode/lock identifiers only when the response
    // package count matches the local package count.
    const updatedPackages = packages.map((box, index) => {
      const sequelBox = packageCountMatches ? sequelBoxDetails[index] : null;

      const packageData = box.toObject ? box.toObject() : { ...box };

      return {
        ...packageData,
        sequelBarcode: sequelBox?.barCode || null,
        sequelLockNumber: sequelBox?.seal_no || null,
      };
    });

    if (!packageCountMatches) {
      console.error("Sequel247 package count mismatch", {
        orderNumber: order.orderNumber,
        localPackageCount: packages.length,
        sequelPackageCount: sequelBoxDetails.length,
        docketNumber,
      });
    }

    // 17. Save successful shipment details
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: id,
        "sequelShipment.bookingStatus": "PENDING",
      },
      {
        $set: {
          "sequelShipment.bookingStatus": "BOOKED",
          "sequelShipment.docketNumber": docketNumber,
          "sequelShipment.brn": brn,
          "sequelShipment.estimatedDelivery": estimatedDelivery,
          "sequelShipment.shipmentStatus": "CREATED",
          "sequelShipment.trackingLink": trackingLink,
          "sequelShipment.docketPrint": docketPrint,
          "sequelShipment.packages": updatedPackages,
          "sequelShipment.bookedAt": new Date(),
          "sequelShipment.bookingError": null,

          trackingNumber: docketNumber,
          courierPartner: "Sequel247",
          shippedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

    // 18. Handle database update failure
    if (!updatedOrder) {
      console.error("Sequel247 shipment created but database update failed", {
        orderId: id,
        docketNumber,
        brn,
      });

      return res.status(500).json({
        success: false,
        message:
          "Shipment was created at Sequel247, but database update failed. Do not retry booking. Reconcile using the docket number.",
        docketNumber,
        brn,
      });
    }

    // 19. Final success response
    return res.status(200).json({
      success: true,
      message: "Sequel247 shipment created successfully",

      data: {
        orderNumber: updatedOrder.orderNumber,
        bookingStatus: updatedOrder.sequelShipment.bookingStatus,
        shipmentStatus: updatedOrder.sequelShipment.shipmentStatus,

        docketNumber,
        brn,
        estimatedDelivery,
        trackingLink,
        docketPrint,

        totalPackages: sequelBoxes.length,
        netWeight,
        grossWeight,

        packageSyncStatus: packageCountMatches ? "MATCHED" : "MISMATCH",
        bookingAttempt: nextAttempt,
        bookingReference,

        packages: updatedPackages.map((box) => ({
          boxNumber: box.boxNumber,
          lockNumber: box.lockNumber,
          sequelBarcode: box.sequelBarcode,
          sequelLockNumber: box.sequelLockNumber,
          grossWeight: box.grossWeight,
        })),
      },
    });
  } catch (error) {
    console.error("Sequel247 shipment booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Shipment booking failed",
      error: error.message,
    });
  }
};

const cleanSequelAddress = (value = "") => {
  return String(value)
    .replace(/[^A-Za-z0-9 ,&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

exports.getSequelShipmentTracking = async (req, res) => {
  try {
    const { id } = req.params;

    // ==========================================
    // 1. FETCH ORDER
    // ==========================================

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ==========================================
    // 2. CHECK SHIPMENT STATUS
    // ==========================================

    const shipment = order.sequelShipment || {};

    const isShipmentBooked =
      shipment.bookingStatus === "BOOKED" && !!shipment.docketNumber;

    let trackingData = {};

    // ==========================================
    // 3. FETCH SEQUEL247 TRACKING
    // ==========================================

    if (isShipmentBooked) {
      try {
        const result = await trackSequelShipment(shipment.docketNumber);

        if (String(result?.status).toLowerCase() === "true") {
          trackingData = result.data || {};
        } else {
          console.warn(
            "Sequel247 tracking response:",
            result?.message || "No tracking information found",
          );
        }
      } catch (trackingError) {
        console.error("Sequel247 tracking API error:", trackingError.message);
      }
    }

    // ==========================================
    // 4. UPDATE SHIPMENT STATUS
    // ==========================================

    if (isShipmentBooked && Object.keys(trackingData).length > 0) {
      if (trackingData.shipment_status) {
        shipment.shipmentStatus = trackingData.shipment_status;
      }

      if (trackingData.estimated_delivery) {
        shipment.estimatedDelivery = trackingData.estimated_delivery;
      }

      // ==========================================
      // 5. MERGE TRACKING HISTORY
      // ==========================================

      const existingTracking = shipment.trackingHistory || [];

      const newTracking = Array.isArray(trackingData.tracking)
        ? trackingData.tracking
        : [];

      const trackingMap = new Map();

      [...existingTracking, ...newTracking].forEach((event) => {
        const normalizedEvent = {
          description: event.description || "",
          location: event.location || "",
          date_time: event.date_time || "",
          code: event.code || "",
        };

        const eventKey = [
          normalizedEvent.code,
          normalizedEvent.date_time,
          normalizedEvent.description,
          normalizedEvent.location,
        ].join("|");

        trackingMap.set(eventKey, normalizedEvent);
      });

      shipment.trackingHistory = [...trackingMap.values()].sort((a, b) =>
        String(a.date_time || "").localeCompare(String(b.date_time || "")),
      );

      shipment.lastTrackedAt = new Date();

      await order.save();
    }

    // ==========================================
    // 6. FETCH PRODUCTS
    // ==========================================

    const productIds = [
      ...new Set(
        order.items.map((item) => String(item.product?._id || item.product)),
      ),
    ];

    const products = await Product.find({
      _id: { $in: productIds },
    })
      .select("name slug images variants category brand")
      .lean();

    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );

    // ==========================================
    // 7. PREPARE ORDER ITEMS
    // ==========================================

    const orderItems = order.items.map((item) => {
      const productId = String(item.product?._id || item.product);

      const product = productMap.get(productId);

      const variant = product?.variants?.find(
        (v) => String(v._id) === String(item.variant),
      );

      const productImage =
        product?.images?.[0] || item.productSnapshot?.image || null;

      return {
        productId,

        productName: item.productSnapshot?.name || product?.name || "Product",

        productImage,

        productImages: product?.images || [],

        slug: item.productSnapshot?.slug || product?.slug || null,

        category: item.productSnapshot?.category || product?.category || null,

        brand: item.productSnapshot?.brand || product?.brand || null,

        // Variant details
        variantId: item.variant,

        sku: item.variantSnapshot?.sku || variant?.sku || null,

        metalType:
          item.variantSnapshot?.metalType || variant?.metalType || null,

        purity: item.variantSnapshot?.purity || variant?.metalPurity || null,

        metalColor:
          item.variantSnapshot?.metalColor || variant?.metalColor || null,

        size: item.variantSnapshot?.size || variant?.size || null,

        grossWeight:
          item.variantSnapshot?.grossWeight ?? variant?.grossWeight ?? 0,

        netWeight: item.variantSnapshot?.netWeight ?? variant?.netWeight ?? 0,

        wastagePercentage:
          item.variantSnapshot?.wastagePercentage ??
          variant?.wastagePercentage ??
          0,

        // Order quantity and price
        quantity: item.quantity,

        unitPrice: item.unitPrice,

        totalPrice: item.totalPrice,

        // Pricing snapshot
        pricing: {
          goldRate: item.pricingSnapshot?.goldRate ?? 0,

          goldValue: item.pricingSnapshot?.goldValue ?? 0,

          makingCharge: item.pricingSnapshot?.makingCharge ?? 0,

          wastageAmount: item.pricingSnapshot?.wastageAmount ?? 0,

          stoneValue: item.pricingSnapshot?.stoneValue ?? 0,

          diamondValue: item.pricingSnapshot?.diamondValue ?? 0,

          discountAmount: item.pricingSnapshot?.discountAmount ?? 0,

          gstPercentage: item.pricingSnapshot?.gstPercentage ?? 0,

          gstAmount: item.pricingSnapshot?.gstAmount ?? 0,

          finalPrice: item.pricingSnapshot?.finalPrice ?? item.totalPrice,
        },
      };
    });

    // ==========================================
    // 8. PREPARE SHIPMENT DETAILS
    // ==========================================

    const shipmentDetails = isShipmentBooked
      ? {
          docketNumber: trackingData.docket_no || shipment.docketNumber || null,

          brn: trackingData.br_number || shipment.brn || null,

          shipmentStatus:
            trackingData.shipment_status || shipment.shipmentStatus || null,

          estimatedDelivery:
            trackingData.estimated_delivery ||
            shipment.estimatedDelivery ||
            null,

          geography: trackingData.geography || "",

          noOfPackages: trackingData.no_of_packages || "",

          requestedPickupDate: trackingData.requested_pickup_date || "",

          actualPickedUpDateTime: trackingData.actual_pickedup_date_time || "",

          pickedUpBy: trackingData.pickedup_by_name || "",

          trackingLink: shipment.trackingLink || "",

          lastTrackedAt: shipment.lastTrackedAt || null,
        }
      : null;

    // ==========================================
    // 9. FINAL RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      message: isShipmentBooked
        ? "Order tracking details fetched successfully."
        : "Order found. Shipment is not assigned yet.",

      data: {
        // ORDER DETAILS
        orderDetails: {
          orderId: order._id,

          orderNumber: order.orderNumber,

          invoiceNumber: order.invoiceNumber || null,

          orderDate: order.createdAt,

          orderStatus: order.orderStatus,

          paymentMethod: order.paymentMethod,

          paymentStatus: order.paymentStatus,

          customer: {
            name: order.customerDetails?.name || "",
          },

          items: orderItems,

          pricing: {
            subTotal: order.subTotal,
            discountAmount: order.discountAmount,
            shippingCharge: order.shippingCharge,
            gstAmount: order.gstAmount,
            totalAmount: order.totalAmount,
          },

          deliveryAddress: {
            fullName: order.addressSnapshot?.fullName || "",

            phone: order.addressSnapshot?.phone || "",

            addressLine1: order.addressSnapshot?.addressLine1 || "",

            addressLine2: order.addressSnapshot?.addressLine2 || "",

            landmark: order.addressSnapshot?.landmark || "",

            city: order.addressSnapshot?.city || "",

            state: order.addressSnapshot?.state || "",

            postalCode:
              order.addressSnapshot?.postalCode ||
              order.addressSnapshot?.pincode ||
              "",

            country: order.addressSnapshot?.country || "",
          },
        },

        // SHIPMENT DETAILS
        shipmentDetails,

        // TRACKING HISTORY
        tracking: isShipmentBooked ? shipment.trackingHistory || [] : [],
      },
    });
  } catch (error) {
    console.error("Sequel247 tracking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch shipment tracking",
      error: error.message,
    });
  }
};

exports.trackMultipleOrders = async (req, res) => {
  try {
    const { orderIds } = req.body;

    // 1. Validate order IDs
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one order",
      });
    }

    const uniqueOrderIds = [
      ...new Set(orderIds.map((id) => String(id).trim())),
    ];

    if (uniqueOrderIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        success: false,
        message: "One or more invalid order IDs",
      });
    }

    // 2. Fetch only booked shipments
    const orders = await Order.find({
      _id: { $in: uniqueOrderIds },
      orderSource: "ONLINE",
      paymentMethod: "ONLINE",
      paymentStatus: "Paid",
      "sequelShipment.bookingStatus": "BOOKED",
      "sequelShipment.docketNumber": { $ne: null },
    });

    if (!orders.length) {
      return res.status(400).json({
        success: false,
        message: "No eligible booked shipments found",
      });
    }

    // 3. Exclude already delivered/cancelled shipments
    const terminalStatuses = ["SDELVD", "SCANCELLED"];

    const eligibleOrders = orders.filter((order) => {
      const status = String(
        order.sequelShipment?.shipmentStatus || "",
      ).toUpperCase();

      return !terminalStatuses.includes(status);
    });

    if (!eligibleOrders.length) {
      return res.status(200).json({
        success: true,
        message: "All selected shipments are already delivered or cancelled",
        data: {
          requested: uniqueOrderIds.length,
          eligible: 0,
          updated: 0,
          skipped: orders.length,
          results: [],
          errors: [],
        },
      });
    }

    // 4. Create docket -> order mapping
    const docketMap = new Map();

    for (const order of eligibleOrders) {
      const docket = String(order.sequelShipment.docketNumber).trim();

      if (!/^\d{10}$/.test(docket)) {
        continue;
      }

      // One docket should belong to one order.
      if (!docketMap.has(docket)) {
        docketMap.set(docket, order);
      }
    }

    const dockets = [...docketMap.keys()];

    if (!dockets.length) {
      return res.status(400).json({
        success: false,
        message: "No valid 10-digit docket numbers found",
      });
    }

    // 5. Call Sequel247 Multiple Tracking API
    const result = await trackMultipleSequelShipments(dockets);

    if (String(result?.status).toLowerCase() !== "true") {
      return res.status(502).json({
        success: false,
        message: result?.message || "Sequel247 bulk tracking failed",
        data: result,
      });
    }

    const successShipments = result.successShipments || {};
    const errorShipments = result.errorShipments || {};

    const updatedResults = [];
    const trackingErrors = [];

    // 6. Process valid shipments
    for (const [docket, trackingData] of Object.entries(successShipments)) {
      const order = docketMap.get(String(docket));

      if (!order) {
        trackingErrors.push({
          docketNumber: docket,
          message: "Matching order not found",
        });
        continue;
      }

      try {
        const shipment = order.sequelShipment;

        const apiStatus = String(
          trackingData.shipment_status || "",
        ).toUpperCase();

        const events = Array.isArray(trackingData.tracking)
          ? trackingData.tracking
          : [];

        // 7. Merge and deduplicate tracking events
        const existingEvents = (shipment.trackingHistory || []).map(
          (event) => ({
            description: event.description || "",
            location: event.location || "",
            date_time: event.date_time || "",
            code: event.code || "",
          }),
        );

        const eventMap = new Map();

        for (const event of [...existingEvents, ...events]) {
          const normalizedEvent = {
            description: event.description || "",
            location: event.location || "",
            date_time: event.date_time || "",
            code: event.code || "",
          };

          const eventKey = [
            normalizedEvent.code,
            normalizedEvent.date_time,
            normalizedEvent.description,
            normalizedEvent.location,
          ].join("|");

          eventMap.set(eventKey, normalizedEvent);
        }

        // 8. Preserve existing status if API status is empty
        if (apiStatus) {
          shipment.shipmentStatus = apiStatus;
        }

        shipment.trackingHistory = [...eventMap.values()];

        shipment.lastTrackedAt = new Date();

        await order.save();

        updatedResults.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          docketNumber: docket,
          shipmentStatus: shipment.shipmentStatus,
          estimatedDelivery:
            trackingData.estimated_delivery || shipment.estimatedDelivery || "",
          trackingEvents: events.length,
          totalSavedEvents: shipment.trackingHistory.length,
          status: "UPDATED",
        });
      } catch (updateError) {
        console.error(
          "Bulk tracking order update failed:",
          order.orderNumber,
          updateError.message,
        );

        trackingErrors.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          docketNumber: docket,
          message: "Tracking fetched but database update failed",
        });
      }
    }

    // 9. Process Sequel247 docket errors
    for (const [docket, errorInfo] of Object.entries(errorShipments)) {
      const order = docketMap.get(String(docket));

      trackingErrors.push({
        orderId: order?._id || null,
        orderNumber: order?.orderNumber || null,
        docketNumber: docket,
        message:
          errorInfo?.docketNo ||
          errorInfo?.docket ||
          "Tracking information unavailable",
      });
    }

    // 10. Final response
    return res.status(200).json({
      success: true,
      message: "Bulk shipment tracking completed",
      data: {
        requested: uniqueOrderIds.length,
        eligible: eligibleOrders.length,
        tracked: dockets.length,
        updated: updatedResults.length,
        skipped: orders.length - eligibleOrders.length,
        results: updatedResults,
        errors: trackingErrors,
      },
    });
  } catch (error) {
    console.error("Sequel247 Bulk Tracking Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process bulk shipment tracking",
      error: error.message,
    });
  }
};

exports.cancelSequelShipmentOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancelReason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (typeof cancelReason !== "string" || !cancelReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const shipment = order.sequelShipment;

    if (
      order.orderSource !== "ONLINE" ||
      order.paymentMethod !== "ONLINE" ||
      order.paymentStatus !== "Paid" ||
      shipment?.bookingStatus !== "BOOKED" ||
      !/^\d{10}$/.test(shipment?.docketNumber || "")
    ) {
      return res.status(400).json({
        success: false,
        message: "Order is not eligible for shipment cancellation",
      });
    }

    if (["SCANCELLED", "SDELVD"].includes(shipment.shipmentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Shipment is already cancelled or delivered",
      });
    }

    const result = await cancelSequelShipment(
      shipment.docketNumber,
      cancelReason,
    );

    if (result?.status !== "true") {
      return res.status(400).json({
        success: false,
        message: result?.message || "Sequel247 cancellation rejected",
        errorInfo: result?.errorInfo || null,
      });
    }

    shipment.bookingStatus = "CANCELLED";
    shipment.shipmentStatus = "SCANCELLED";
    shipment.cancelReason = cancelReason.trim();
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Sequel247 shipment cancelled successfully",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        docketNumber: shipment.docketNumber,
        bookingStatus: shipment.bookingStatus,
        shipmentStatus: shipment.shipmentStatus,
        cancelReason,
      },
    });
  } catch (error) {
    console.error("Sequel247 cancellation error:", error);

    return res.status(502).json({
      success: false,
      message:
        "Shipment cancellation could not be confirmed. Verify Sequel247 status before retrying.",
    });
  }
};

exports.downloadOrderPOD = async (req, res) => {
  try {
    const { id } = req.params;
    const { fromDate, toDate } = req.body;

    // 1. Validate Order ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // 2. Fetch Order
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 3. Validate shipment
    const shipment = order.sequelShipment;

    if (
      !shipment ||
      shipment.bookingStatus !== "BOOKED" ||
      !shipment.docketNumber
    ) {
      return res.status(400).json({
        success: false,
        message: "No active booked shipment found",
      });
    }

    const docketNumber = String(shipment.docketNumber).trim();

    if (!/^\d{10}$/.test(docketNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sequel247 docket number",
      });
    }

    // 4. Validate dates (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    const isValidDate = (date) => {
      if (!dateRegex.test(date || "")) {
        return false;
      }

      const parsedDate = new Date(`${date}T00:00:00Z`);

      return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === date
      );
    };

    if (!isValidDate(fromDate) || !isValidDate(toDate)) {
      return res.status(400).json({
        success: false,
        message: "Valid dates are required in YYYY-MM-DD format",
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        success: false,
        message: "From date cannot be greater than To date",
      });
    }

    // 5. Request POD from Sequel247
    const result = await downloadSequelPOD({
      requestType: "docket",
      dockets: [docketNumber],
      fromDate,
      toDate,
    });

    // 6. Handle POD unavailable / API failure
    if (String(result?.status).toLowerCase() !== "true") {
      return res.status(400).json({
        success: false,
        message: result?.message || "POD not available",
        errorInfo: result?.errorInfo || [],
      });
    }

    if (!result.link) {
      return res.status(502).json({
        success: false,
        message: "POD link was not returned by Sequel247",
      });
    }

    // 7. Success response
    return res.status(200).json({
      success: true,
      message: result.message || "POD generated successfully",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        docketNumber,
        podLink: result.link,
      },
    });
  } catch (error) {
    console.error("POD Download Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch POD",
      error: error.message,
    });
  }
};

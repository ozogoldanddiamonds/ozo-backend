const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const PaymentAttempt = require("../models/payment-attempt");
const Order = require("../models/order");
const Product = require("../models/product");
const User = require("../models/user-login");
const Address = require("../models/address");
const Admin = require("../models/user");
const { sendInvoiceEmail } = require("../middleware/mail");
const SupplierPurchaseItem = require("../models/supplier-purchase-items");
const MakerProductionItem = require("../models/maker-production-item");
const generateOrderInvoice = require("../utils/generate-order-invoice");
const uploadInvoicePdf = require("../middleware/upload-invoice-pdf");
const sendOrderWhatsApp = require("../utils/send-order-whatsapp");
const sendOrderSuccessSms = require("../utils/send-order-success-sms");
const calculateVariantPrice = require("../utils/price-calculator");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const formatDate = (date) =>
  new Date(date || Date.now()).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

exports.createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const { productId, variantId, quantity, items, addressId } = req.body;

    // 1. Validate user
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    // 2. Validate address
    if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Valid address is required",
      });
    }

    // 3. Support Buy Now and Cart
    let checkoutItems = [];

    if (Array.isArray(items) && items.length > 0) {
      checkoutItems = items.map((item) => ({
        productId: item.productId || item.product,
        variantId: item.variantId || item.variant,
        quantity: Number(item.quantity),
      }));
    } else if (productId && variantId) {
      checkoutItems = [
        {
          productId,
          variantId,
          quantity: Number(quantity),
        },
      ];
    }

    if (!checkoutItems.length) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required",
      });
    }

    // 4. Validate and aggregate duplicate items
    const aggregatedItems = new Map();

    for (const item of checkoutItems) {
      if (
        !mongoose.Types.ObjectId.isValid(item.productId) ||
        !mongoose.Types.ObjectId.isValid(item.variantId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product, variant or quantity",
        });
      }

      const key = `${item.productId}_${item.variantId}`;

      if (aggregatedItems.has(key)) {
        aggregatedItems.get(key).quantity += item.quantity;
      } else {
        aggregatedItems.set(key, { ...item });
      }
    }

    checkoutItems = Array.from(aggregatedItems.values());

    // 5. Load products and calculate backend prices
    let totalAmount = 0;
    const paymentAttemptItems = [];

    for (const item of checkoutItems) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const variant = product.variants.id(item.variantId);

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: `Variant not found for ${product.name}`,
        });
      }

      // 6. Validate available Product stock
      // Only check stock here. Do not decrease it.
      const availableStock = Number(variant.stock || 0);

      if (availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available stock: ${availableStock}`,
        });
      }

      // 7. Calculate backend price
      const priceDetails = await calculateVariantPrice(variant);
      const unitPrice = Number(priceDetails?.finalPrice);

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for ${product.name}`,
        });
      }

      const finalUnitPrice = Number(unitPrice.toFixed(2));

      const itemTotalPrice = Number(
        (finalUnitPrice * item.quantity).toFixed(2),
      );

      totalAmount += itemTotalPrice;

      paymentAttemptItems.push({
        product: product._id,
        variantId: variant._id.toString(),
        quantity: item.quantity,

        productSnapshot: product.toObject({
          depopulate: true,
          versionKey: false,
        }),

        variantSnapshot: variant.toObject({
          depopulate: true,
          versionKey: false,
        }),

        pricingSnapshot: priceDetails,
        unitPrice: finalUnitPrice,
        totalPrice: itemTotalPrice,

        // No stock reservation during payment initiation
        stockAllocations: [],
        stockReservationStatus: "NOT_RESERVED",
      });
    }

    totalAmount = Number(totalAmount.toFixed(2));

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    // 8. Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `pay_${Date.now()}`,
    });

    const isBuyNow = !(Array.isArray(items) && items.length > 0);

    // 9. Create PaymentAttempt
    const attemptData = {
      user: userId,
      address: addressId,
      amount: totalAmount,
      currency: "INR",
      razorpayOrderId: razorpayOrder.id,

      orderSource: "ONLINE",

      status: "CREATED",
      checkoutMode: isBuyNow ? "BUY_NOW" : "CART",
      items: paymentAttemptItems,
    };

    if (isBuyNow) {
      attemptData.product = paymentAttemptItems[0].product;
      attemptData.variantId = paymentAttemptItems[0].variantId;
      attemptData.quantity = paymentAttemptItems[0].quantity;
    }

    const createdAttempt = await PaymentAttempt.create(attemptData);

    // 10. Return payment details
    return res.status(201).json({
      success: true,
      message: "Razorpay order created successfully",
      data: {
        paymentAttemptId: createdAttempt._id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("Create Razorpay Order Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to initiate payment",
    });
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  const totalStartedAt = Date.now();

  const timed = async (label, callback) => {
    const startedAt = Date.now();

    try {
      return await callback();
    } finally {
      console.log(`[PAYMENT TIMING] ${label}: ${Date.now() - startedAt} ms`);
    }
  };

  try {
    const userId = req.user?.userId;

    const {
      paymentAttemptId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // 1. Validate user
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    // 2. Validate payment details
    if (
      !paymentAttemptId ||
      !mongoose.Types.ObjectId.isValid(paymentAttemptId) ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Required payment details are missing or invalid",
      });
    }

    // 3. Find PaymentAttempt
    const attempt = await timed("PAYMENT_ATTEMPT_LOOKUP", () =>
      PaymentAttempt.findOne({
        _id: paymentAttemptId,
        user: userId,
        razorpayOrderId: razorpay_order_id,
      }),
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Payment attempt not found",
      });
    }

    // 4. Already completed order
    if (attempt.status === "ORDER_CREATED") {
      return res.status(200).json({
        success: true,
        message: "Payment and order already completed",
        data: {
          paymentAttemptId: attempt._id,
          status: "ORDER_CREATED",
          orderId: attempt.order || null,
        },
      });
    }

    if (!["CREATED", "PAID"].includes(attempt.status)) {
      return res.status(409).json({
        success: false,
        message: "This payment attempt cannot be processed",
        status: attempt.status,
      });
    }

    // 5. Verify Razorpay signature
    const signatureStartedAt = Date.now();

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${attempt.razorpayOrderId}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    let receivedBuffer;

    try {
      receivedBuffer = Buffer.from(razorpay_signature, "hex");
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    console.log(
      `[PAYMENT TIMING] SIGNATURE_VERIFICATION: ${
        Date.now() - signatureStartedAt
      } ms`,
    );

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // 6. Fetch payment details from Razorpay
    const payment = await timed("RAZORPAY_PAYMENT_FETCH", () =>
      razorpay.payments.fetch(razorpay_payment_id),
    );

    if (
      payment.order_id !== attempt.razorpayOrderId ||
      payment.amount !== Math.round(attempt.amount * 100) ||
      payment.currency !== attempt.currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details do not match the payment attempt",
      });
    }

    if (payment.status !== "captured") {
      return res.status(409).json({
        success: false,
        message: "Payment is not captured yet",
        paymentStatus: payment.status,
      });
    }

    // 7. Mark PaymentAttempt as PAID
    if (attempt.status === "CREATED") {
      const updatedAttempt = await timed("MARK_PAYMENT_PAID", () =>
        PaymentAttempt.findOneAndUpdate(
          {
            _id: attempt._id,
            user: userId,
            status: "CREATED",
          },
          {
            $set: {
              status: "PAID",
              razorpayPaymentId: razorpay_payment_id,
            },
          },
          {
            new: true,
          },
        ),
      );

      if (!updatedAttempt) {
        const latest = await timed("RECHECK_PAYMENT_ATTEMPT", () =>
          PaymentAttempt.findById(attempt._id),
        );

        if (latest?.status === "ORDER_CREATED") {
          return res.status(200).json({
            success: true,
            message: "Order already created",
            data: {
              paymentAttemptId: latest._id,
              status: latest.status,
              orderId: latest.order || null,
            },
          });
        }

        if (latest?.status !== "PAID") {
          return res.status(409).json({
            success: false,
            message: "Payment attempt is being processed",
            status: latest?.status,
          });
        }
      }
    }

    // 8. Check existing order
    let order = await timed("EXISTING_ORDER_LOOKUP", () =>
      Order.findOne({
        razorpayOrderId: attempt.razorpayOrderId,
      }),
    );

    if (!order) {
      // 9. Build order items from PaymentAttempt
      let orderItems = [];

      if (Array.isArray(attempt.items) && attempt.items.length > 0) {
        orderItems = attempt.items.map((item) => ({
          product: item.product,
          variant: item.variantId,
          quantity: item.quantity,

          productSnapshot: item.productSnapshot,
          variantSnapshot: item.variantSnapshot,
          pricingSnapshot: item.pricingSnapshot,

          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }));
      } else if (
        attempt.product &&
        attempt.variantId &&
        Number(attempt.quantity) >= 1
      ) {
        orderItems = [
          {
            product: attempt.product,
            variant: attempt.variantId,
            quantity: attempt.quantity,
          },
        ];
      }

      if (!orderItems.length) {
        console.error("Payment attempt has no valid order items:", attempt._id);

        return res.status(500).json({
          success: false,
          message: "Payment verified, but order items could not be recovered",
          data: {
            paymentAttemptId: attempt._id,
            status: "PAID",
          },
        });
      }

      // 10. Call createOrder
      // Stock must be deducted only inside createOrder transaction.
      let orderResponse;
      let responseStatus = 200;

      const internalReq = {
        user: req.user,
        body: {
          orderSource: "ONLINE",
          user: userId,
          address: attempt.address,
          items: orderItems,
          paymentMethod: "ONLINE",
          razorpayOrderId: attempt.razorpayOrderId,
          razorpayPaymentId: razorpay_payment_id,
          paymentAttemptId: attempt._id,
        },
      };

      const internalRes = {
        status(code) {
          responseStatus = code;
          return this;
        },

        json(body) {
          orderResponse = body;
          return this;
        },
      };

      await timed("CREATE_ORDER_TOTAL", () =>
        exports.createOrder(internalReq, internalRes),
      );

      if (
        responseStatus >= 400 ||
        !orderResponse?.success ||
        !orderResponse?.data?._id
      ) {
        // Recover if order was created by another request
        order = await timed("ORDER_RECOVERY_LOOKUP", () =>
          Order.findOne({
            razorpayOrderId: attempt.razorpayOrderId,
          }),
        );

        if (!order) {
          console.error("Order creation after payment failed:", orderResponse);

          return res.status(500).json({
            success: false,
            message:
              orderResponse?.message ||
              "Payment verified, but order creation failed",
            data: {
              paymentAttemptId: attempt._id,
              status: "PAID",
            },
          });
        }
      } else {
        order = orderResponse.data;
      }
    }

    // 11. Update PaymentAttempt as ORDER_CREATED
    const completedAttempt = await timed("MARK_ORDER_CREATED", () =>
      PaymentAttempt.findOneAndUpdate(
        {
          _id: attempt._id,
          user: userId,
          status: "PAID",
        },
        {
          $set: {
            status: "ORDER_CREATED",
            razorpayPaymentId: razorpay_payment_id,
            order: order._id,
          },
        },
        {
          new: true,
        },
      ),
    );

    if (!completedAttempt) {
      const latest = await timed("FINAL_ATTEMPT_RECHECK", () =>
        PaymentAttempt.findById(attempt._id),
      );

      if (latest?.status !== "ORDER_CREATED") {
        return res.status(500).json({
          success: false,
          message: "Order exists, but payment attempt update is pending",
          data: {
            orderId: order._id,
            status: latest?.status,
          },
        });
      }
    }

    // 12. Success response
    return res.status(200).json({
      success: true,
      message: "Payment verified and order created successfully",
      data: {
        paymentAttemptId: attempt._id,
        razorpayOrderId: attempt.razorpayOrderId,
        razorpayPaymentId: razorpay_payment_id,
        status: "ORDER_CREATED",
        orderId: order._id,
      },
    });
  } catch (error) {
    console.error("Razorpay Verification / Order Creation Error:", error);

    return res.status(500).json({
      success: false,
      message: "Payment was received, but order processing needs attention",
    });
  } finally {
    console.log(
      `[PAYMENT TIMING] VERIFY_PAYMENT_TOTAL: ${
        Date.now() - totalStartedAt
      } ms`,
    );
  }
};

exports.createOrder = async (req, res) => {
  let session = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const {
      orderSource,
      user: userId,
      address: addressId,
      items,
      paymentMethod,
      razorpayOrderId,
      razorpayPaymentId,
      paymentAttemptId,
      branch,
      subBranch,
      createdBy,
      customerDetails,
      discountAmount = 0,
      couponCode = "",
      shippingCharge = 0,
      gstAmount = 0,
    } = req.body;

    // ==========================================
    // 1. VALIDATE ORDER SOURCE
    // ==========================================

    if (!["ONLINE", "BRANCH", "SUB_BRANCH"].includes(orderSource)) {
      throw new Error("Invalid order source");
    }

    if (!paymentMethod || !items) {
      throw new Error("Payment method and items are required");
    }

    // ==========================================
    // 2. DUPLICATE ORDER CHECK
    // ==========================================

    if (razorpayOrderId) {
      const existingOrder = await Order.findOne({
        razorpayOrderId,
      }).session(session);

      if (existingOrder) {
        await session.abortTransaction();

        return res.status(200).json({
          success: true,
          message: "Order already exists for this payment",
          data: existingOrder,
        });
      }
    }

    // ==========================================
    // 3. PARSE ITEMS
    // ==========================================

    let parsedItems = items;

    if (typeof items === "string") {
      parsedItems = JSON.parse(items);
    }

    if (!Array.isArray(parsedItems) || !parsedItems.length) {
      throw new Error("At least one order item is required");
    }

    // ==========================================
    // 4. CUSTOMER AND PAYMENT VALIDATION
    // ==========================================

    let user = null;
    let address = null;
    let paymentAttempt = null;

    if (paymentAttemptId) {
      if (!mongoose.Types.ObjectId.isValid(paymentAttemptId)) {
        throw new Error("Invalid payment attempt ID");
      }

      paymentAttempt =
        await PaymentAttempt.findById(paymentAttemptId).session(session);

      if (!paymentAttempt) {
        throw new Error("Payment attempt not found");
      }

      if (paymentAttempt.status !== "PAID") {
        throw new Error("Payment is not completed");
      }

      if (paymentAttempt.orderSource !== orderSource) {
        throw new Error("Payment attempt order source mismatch");
      }

      if (paymentAttempt.razorpayOrderId !== razorpayOrderId) {
        throw new Error("Razorpay order ID mismatch");
      }

      if (
        paymentAttempt.razorpayPaymentId &&
        paymentAttempt.razorpayPaymentId !== razorpayPaymentId
      ) {
        throw new Error("Razorpay payment ID mismatch");
      }

      if (!paymentAttempt.razorpayPaymentId && !razorpayPaymentId) {
        throw new Error("Razorpay payment ID is required");
      }

      // ONLINE CUSTOMER
      if (orderSource === "ONLINE") {
        if (paymentAttempt.user?.toString() !== userId?.toString()) {
          throw new Error("Payment attempt user mismatch");
        }

        if (userId) {
          user = await User.findById(userId).session(session);
        }

        if (!user) {
          throw new Error("Customer not found");
        }

        if (addressId) {
          address = await Address.findById(addressId).session(session);
        } else if (paymentAttempt.address) {
          address = await Address.findById(paymentAttempt.address).session(
            session,
          );
        }

        if (!address) {
          throw new Error("Customer address not found");
        }

        if (paymentAttempt.address?.toString() !== address._id.toString()) {
          throw new Error("Payment address mismatch");
        }
      }

      // BRANCH / SUB_BRANCH POS CUSTOMER
      else {
        if (paymentAttempt.createdBy?.toString() !== createdBy?.toString()) {
          throw new Error("POS payment creator mismatch");
        }

        if (paymentAttempt.branch?.toString() !== branch?.toString()) {
          throw new Error("POS branch mismatch");
        }

        if (
          orderSource === "SUB_BRANCH" &&
          paymentAttempt.subBranch?.toString() !== subBranch?.toString()
        ) {
          throw new Error("POS sub-branch mismatch");
        }

        if (
          !paymentAttempt.customerDetails?.name ||
          !paymentAttempt.customerDetails?.phone
        ) {
          throw new Error("POS customer details missing");
        }
      }
    } else if (orderSource === "ONLINE") {
      throw new Error("Payment attempt ID is required");
    }

    // ==========================================
    // 5. BRANCH VALIDATION
    // ==========================================

    if (orderSource === "BRANCH") {
      if (
        !branch ||
        !mongoose.Types.ObjectId.isValid(branch) ||
        !(await Admin.findById(branch).session(session))
      ) {
        throw new Error("Valid branch admin is required");
      }
    }

    if (orderSource === "SUB_BRANCH") {
      if (
        !subBranch ||
        !mongoose.Types.ObjectId.isValid(subBranch) ||
        !(await Admin.findById(subBranch).session(session))
      ) {
        throw new Error("Valid sub branch admin is required");
      }
    }

    if (createdBy && !(await Admin.findById(createdBy).session(session))) {
      throw new Error("Created by admin not found");
    }

    // ==========================================
    // 6. ORDER NUMBERS
    // ==========================================

    const timestamp = Date.now();

    const orderNumber = `ORD-${timestamp}`;
    const invoiceNumber = `INV-${timestamp}`;

    // ==========================================
    // 7. ADDRESS SNAPSHOT
    // ==========================================

    let addressSnapshot = null;

    if (address) {
      addressSnapshot = {
        fullName: address.fullName,
        phone: address.phone,
        alternatePhone: address.alternatePhone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode,
      };
    }

    // ==========================================
    // 8. TOTALS
    // ==========================================

    const orderItems = [];

    let subTotal = 0;
    let totalDiscount = Number(discountAmount) || 0;
    let totalGst = 0;

    if (!Number.isFinite(totalDiscount) || totalDiscount < 0) {
      throw new Error("Invalid discount amount");
    }

    const finalShippingCharge = Number(shippingCharge) || 0;

    if (!Number.isFinite(finalShippingCharge) || finalShippingCharge < 0) {
      throw new Error("Invalid shipping charge");
    }

    // ==========================================
    // 9. PROCESS ORDER ITEMS
    // ==========================================

    for (const item of parsedItems) {
      if (!item.product || !item.variant) {
        throw new Error("Product and variant are required");
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Invalid item quantity");
      }

      // FIND PRODUCT
      const product = await Product.findById(item.product).session(session);

      if (!product) {
        throw new Error(`Product not found: ${item.product}`);
      }

      // FIND VARIANT
      const variant = product.variants.find(
        (v) => v._id.toString() === item.variant.toString(),
      );

      if (!variant) {
        throw new Error(`Variant not found for product ${product.name}`);
      }

      // PAYMENT SNAPSHOT
      const savedItem = paymentAttempt
        ? paymentAttempt.items?.find(
            (p) =>
              p.product.toString() === product._id.toString() &&
              p.variantId.toString() === variant._id.toString(),
          )
        : null;

      if (paymentAttempt && !savedItem) {
        throw new Error(
          `Payment item not found for ${product.name} - ${variant.sku}`,
        );
      }

      if (orderSource === "ONLINE") {
        if (!savedItem) {
          throw new Error(
            `Payment item not found for ${product.name} - ${variant.sku}`,
          );
        }

        if (Number(savedItem.quantity) !== quantity) {
          throw new Error(`Payment quantity mismatch for ${product.name}`);
        }
      }

      // ==========================================
      // PRICE DETAILS
      // ==========================================

      let priceDetails;
      let unitPrice;
      let totalPrice;

      // No supplier/maker allocation.
      const stockAllocations = [];

      // ONLINE ORDER PRICING
      if (orderSource === "ONLINE") {
        priceDetails = savedItem.pricingSnapshot;

        unitPrice = Number(savedItem.unitPrice);
        totalPrice = Number(savedItem.totalPrice);

        if (
          !priceDetails ||
          !Number.isFinite(unitPrice) ||
          !Number.isFinite(totalPrice) ||
          unitPrice <= 0 ||
          totalPrice <= 0 ||
          Math.abs(totalPrice - unitPrice * quantity) > 0.01
        ) {
          throw new Error(`Invalid saved pricing for ${product.name}`);
        }
      }

      // BRANCH / SUB_BRANCH PRICING
      else {
        priceDetails = await calculateVariantPrice(variant);

        if (!priceDetails) {
          throw new Error(`Unable to calculate price for ${product.name}`);
        }

        unitPrice = Number(priceDetails.finalPrice) || 0;

        totalPrice = Number((unitPrice * quantity).toFixed(2));

        if (
          !Number.isFinite(unitPrice) ||
          unitPrice <= 0 ||
          !Number.isFinite(totalPrice)
        ) {
          throw new Error(`Invalid product price for ${product.name}`);
        }
      }

      // ==========================================
      // STOCK VALIDATION AND DEDUCTION
      // ==========================================

      const stockUpdate = await Product.updateOne(
        {
          _id: product._id,
          variants: {
            $elemMatch: {
              _id: variant._id,
              stock: {
                $gte: quantity,
              },
            },
          },
        },
        {
          $inc: {
            "variants.$.stock": -quantity,
          },
        },
        {
          session,
        },
      );

      if (stockUpdate.modifiedCount !== 1) {
        throw new Error(
          `Insufficient product stock for ${product.name} - SKU ${variant.sku}`,
        );
      }

      // Update local variant for any subsequent snapshot usage
      variant.stock = Number(variant.stock || 0) - quantity;

      // ==========================================
      // STONE WEIGHTS
      // ==========================================

      const stoneWeight =
        variant.stones?.reduce(
          (total, stone) => total + (Number(stone.totalWeight) || 0),
          0,
        ) || 0;

      const diamondWeight =
        variant.stones
          ?.filter((stone) => stone.stoneType === "diamond")
          .reduce(
            (total, stone) => total + (Number(stone.totalWeight) || 0),
            0,
          ) || 0;

      // ==========================================
      // PRODUCT SNAPSHOT
      // ==========================================

      const productSnapshot = savedItem?.productSnapshot || {
        name: product.name,
        slug: product.slug,
        image: product.images?.[0] || null,
        category: product.category?.toString() || null,
        subCategory: product.subCategory?.toString() || null,
        subSubCategory: product.subSubCategory?.toString() || null,
        productType: product.productType,
        brand: product.brand || "",
      };

      // ==========================================
      // STONES SNAPSHOT
      // ==========================================

      const stonesSnapshot =
        variant.stones?.map((stone) => ({
          stoneType: stone.stoneType,
          stoneCategory: stone.stoneCategory,
          quality: stone.quality,
          quantity: Number(stone.quantity) || 0,
          totalWeight: Number(stone.totalWeight) || 0,
          stoneValue: Number(stone.stoneValue) || 0,
        })) || [];

      // ==========================================
      // VARIANT SNAPSHOT
      // ==========================================

      const variantSnapshot = savedItem?.variantSnapshot || {
        sku: variant.sku,
        metalType: variant.metalType,
        purity: variant.metalPurity,
        metalColor: variant.metalColor,
        size: variant.size,
        grossWeight: Number(variant.grossWeight) || 0,
        netWeight: Number(variant.netWeight) || 0,
        wastagePercentage: Number(variant.wastagePercentage) || 0,
        stoneWeight,
        diamondWeight,
        makingCharge: Number(variant.makingCharges) || 0,
        makingChargeType: variant.makingChargeType,
        discountPercentage: Number(variant.discountPercentage) || 0,
        stoneType: stonesSnapshot?.[0]?.stoneType || null,
        gender: product.gender || null,
        stones: stonesSnapshot,
      };

      // ==========================================
      // PRICING SNAPSHOT
      // ==========================================

      const pricingSnapshot = savedItem?.pricingSnapshot || {
        goldRate: Number(priceDetails.goldRate) || 0,
        goldValue: Number(priceDetails.goldValue) || 0,
        wastageAmount: Number(priceDetails.wastageAmount) || 0,
        stoneValue: Number(priceDetails.stoneValue) || 0,
        diamondValue: Number(priceDetails.diamondValue) || 0,
        makingCharge: Number(priceDetails.makingCharge) || 0,
        discountAmount: Number(priceDetails.discountAmount) || 0,
        gstPercentage: Number(priceDetails.gstPercentage) || 0,
        gstAmount: Number(priceDetails.gstAmount) || 0,
        finalPrice: unitPrice,
      };

      // ==========================================
      // CREATE ORDER ITEM
      // ==========================================

      orderItems.push({
        product: product._id,
        variant: variant._id,
        productSnapshot,
        stockAllocations,
        variantSnapshot,
        pricingSnapshot,
        quantity,
        unitPrice,
        totalPrice,
      });

      subTotal += totalPrice;

      totalGst += (Number(priceDetails.gstAmount) || 0) * quantity;
    }

    // ==========================================
    // 10. FINAL TOTAL
    // ==========================================

    subTotal = Number(subTotal.toFixed(2));
    totalGst = Number(totalGst.toFixed(2));

    const finalTotal = Number(
      (subTotal - totalDiscount + finalShippingCharge).toFixed(2),
    );

    if (!Number.isFinite(finalTotal) || finalTotal < 0) {
      throw new Error("Invalid order total");
    }

    // ==========================================
    // 11. PAYMENT AMOUNT VALIDATION
    // ==========================================

    if (paymentAttempt) {
      const attemptAmount = Number(paymentAttempt.amount);

      if (
        !Number.isFinite(attemptAmount) ||
        Math.round(attemptAmount * 100) !== Math.round(finalTotal * 100)
      ) {
        throw new Error("Payment amount mismatch");
      }
    }

    // ==========================================
    // 12. PAYMENT STATUS
    // ==========================================

    let paymentStatus = "Pending";

    if (
      ["CASH", "UPI", "CARD", "ONLINE", "NETBANKING"].includes(paymentMethod)
    ) {
      paymentStatus = "Paid";
    }

    if (paymentMethod === "COD") {
      paymentStatus = "Pending";
    }

    const orderStatus = "Confirmed";

    // ==========================================
    // 13. CUSTOMER DETAILS
    // ==========================================

    let finalCustomerDetails = customerDetails || {};

    if (user) {
      finalCustomerDetails = {
        name: customerDetails?.name || user.name || "",
        phone: customerDetails?.phone || user.phone || "",
        email: customerDetails?.email || user.email || "",
      };
    }

    // POS customer details from PaymentAttempt
    if (paymentAttempt && orderSource !== "ONLINE") {
      finalCustomerDetails = {
        name: paymentAttempt.customerDetails.name,
        phone: paymentAttempt.customerDetails.phone,
        email: paymentAttempt.customerDetails.email || "",
      };
    }

    // ==========================================
    // 14. CREATE ORDER
    // ==========================================

    const order = new Order({
      orderNumber,
      invoiceNumber,
      orderSource,

      branch: branch || null,
      subBranch: subBranch || null,
      createdBy: createdBy || null,

      user: user?._id || null,

      customerDetails: finalCustomerDetails,

      items: orderItems,

      address: address?._id || null,
      addressSnapshot,

      paymentMethod,
      paymentStatus,

      subTotal,
      discountAmount: totalDiscount,
      couponCode,

      shippingCharge: finalShippingCharge,
      gstAmount: totalGst,
      totalAmount: finalTotal,

      orderStatus,
      billingStatus: "Completed",

      statusHistory: [
        {
          status: orderStatus,
          updatedBy: createdBy || null,
          remarks: "Order created",
          updatedAt: new Date(),
        },
      ],

      invoiceDate: new Date(),

      stockUpdated: true,

      razorpayOrderId: razorpayOrderId || null,
      razorpayPaymentId: razorpayPaymentId || null,

      paymentHistory: razorpayPaymentId
        ? [
            {
              method: "ONLINE",
              amount: finalTotal,
              transactionId: razorpayPaymentId,
              paymentGateway: "Razorpay",
              paidAt: new Date(),
            },
          ]
        : [],
    });

    await order.save({ session });

    // ==========================================
    // 15. UPDATE PAYMENT ATTEMPT
    // ==========================================

    if (paymentAttempt) {
      const attemptResult = await PaymentAttempt.updateOne(
        {
          _id: paymentAttempt._id,
          status: "PAID",
        },
        {
          $set: {
            status: "ORDER_CREATED",
            order: order._id,
            razorpayPaymentId,
          },
        },
        {
          session,
        },
      );

      if (attemptResult.modifiedCount !== 1) {
        throw new Error("Unable to update payment attempt status");
      }
    }

    // ==========================================
    // 16. COMMIT TRANSACTION
    // =
    // ==========================================
    // 16. COMMIT TRANSACTION
    // ==========================================

    await session.commitTransaction();

    console.log("========== ORDER CREATED ==========");
    console.log("Order Number:", order.orderNumber);
    console.log("Payment Status:", order.paymentStatus);

    // Transaction completed.
    // Notification failures must NOT rollback the order.
    order.$session(null);

    // Notification result variables
    let orderSmsSent = false;
    let orderSmsError = null;

    let whatsappSent = false;
    let whatsappError = null;

    const customerPhone =
      order.customerDetails?.phone || order.addressSnapshot?.phone || "";

    const customerName =
      order.customerDetails?.name || order.addressSnapshot?.fullName;

    // ==========================================
    // 17. GENERATE AND UPLOAD INVOICE PDF
    // ==========================================

    let invoiceReady = false;

    try {
      console.log(
        "========== INVOICE GENERATION STARTED ==========",
        order.invoiceNumber,
      );

      const invoiceBuffer = await generateOrderInvoice(order);

      if (!invoiceBuffer) {
        throw new Error("Invoice PDF generation failed");
      }

      const uploadedInvoice = await uploadInvoicePdf(
        invoiceBuffer,
        order.invoiceNumber,
      );

      if (!uploadedInvoice?.url) {
        throw new Error("Invoice PDF upload failed");
      }

      // Save invoice URL
      order.invoicePdfUrl = uploadedInvoice.url;
      order.invoiceGeneratedAt = new Date();

      order.whatsappInvoiceStatus = "PENDING";
      order.whatsappInvoiceError = null;

      await order.save();

      invoiceReady = true;

      console.log("========== INVOICE UPLOADED ==========");
      console.log("Invoice Number:", order.invoiceNumber);
      console.log("Invoice URL:", order.invoicePdfUrl);
    } catch (invoiceError) {
      console.error("INVOICE GENERATION FAILED:", {
        orderNumber: order.orderNumber,
        message: invoiceError.message,
      });

      order.whatsappInvoiceStatus = "FAILED";
      order.whatsappInvoiceError = invoiceError.message;

      try {
        await order.save();
      } catch (saveError) {
        console.error("INVOICE STATUS SAVE ERROR:", saveError.message);
      }
    }

    // ==========================================
    // 18. SEND ORDER SUCCESS SMS
    // ==========================================

    if (invoiceReady) {
      try {
        console.log("========== ORDER SMS STARTED ==========");

        if (!customerPhone) {
          throw new Error("Customer SMS number not found");
        }

        // Prepare product details from Order Schema
        const productDetails = order.items
          .map((item, index) => {
            const productName = item.productSnapshot?.name || "Product";

            const quantity = Number(item.quantity) || 0;

            const unitPrice = Number(item.unitPrice) || 0;

            const totalPrice = Number(item.totalPrice) || 0;

            return (
              `${index + 1}. ${productName}` +
              ` - Qty: ${quantity}` +
              ` - Unit Price: Rs.${unitPrice.toFixed(2)}` +
              ` - Total: Rs.${totalPrice.toFixed(2)}`
            );
          })
          .join("; ");

        // Buddy SMS service
        const smsResult = await sendOrderSuccessSms({
          phone: customerPhone,
          customerName,
          orderNumber: order.orderNumber,
          orderDate: formatDate(order.createdAt),
          productDetails,
          totalAmount: order.totalAmount,
          paymentMode: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          invoiceUrl: order.invoicePdfUrl,
        });

        if (smsResult?.success !== true) {
          throw new Error(
            smsResult?.message || "Buddy SMS gateway rejected the request",
          );
        }

        orderSmsSent = true;

        console.log("========== ORDER SMS ACCEPTED ==========");
        console.log({
          orderNumber: order.orderNumber,
          phone: customerPhone,
          referenceId: smsResult.reference_id || null,
          response: smsResult,
        });
      } catch (smsError) {
        orderSmsError =
          smsError.response?.data?.message ||
          smsError.message ||
          "Order success SMS failed";

        console.error("========== ORDER SMS FAILED ==========", {
          orderNumber: order.orderNumber,
          phone: customerPhone,
          message: orderSmsError,
          response: smsError.response?.data || null,
        });
      }
    } else {
      orderSmsError =
        "SMS not sent because invoice PDF generation or upload failed";

      console.log("ORDER SMS SKIPPED:", orderSmsError);
    }

    // ==========================================
    // 19. SEND WHATSAPP WITH PDF ATTACHMENT
    // ==========================================

    if (invoiceReady) {
      try {
        console.log("========== WHATSAPP STARTED ==========");

        if (!customerPhone) {
          throw new Error("Customer WhatsApp number not found");
        }

        const whatsappResult = await sendOrderWhatsApp({
          phone: customerPhone,

          customerName,

          orderId: order.orderNumber,

          orderDate: formatDate(order.createdAt),

          orderAmount: Number(order.totalAmount || 0).toFixed(2),

          paymentStatus: order.paymentStatus,

          invoiceUrl: order.invoicePdfUrl,
        });

        if (!whatsappResult?.success || !whatsappResult?.messageId) {
          throw new Error(
            whatsappResult?.message ||
              "WhatsApp gateway did not confirm message acceptance",
          );
        }

        order.whatsappInvoiceStatus = "ACCEPTED";

        order.whatsappMessageId = whatsappResult.messageId;

        order.whatsappInvoiceError = null;

        await order.save();

        whatsappSent = true;

        console.log("========== WHATSAPP ACCEPTED ==========");

        console.log({
          orderNumber: order.orderNumber,
          messageId: order.whatsappMessageId,
        });
      } catch (whatsappErr) {
        whatsappError =
          whatsappErr.response?.data?.error?.message ||
          whatsappErr.response?.data?.message ||
          whatsappErr.message ||
          "WhatsApp invoice sending failed";
        ("WhatsApp invoice sending failed");

        console.error("========== WHATSAPP FAILED ==========", {
          orderNumber: order.orderNumber,
          message: whatsappError,
        });

        order.whatsappInvoiceStatus = "FAILED";
        order.whatsappInvoiceError = whatsappError;

        try {
          await order.save();
        } catch (saveError) {
          console.error("WHATSAPP STATUS SAVE FAILED:", saveError.message);
        }
      }
    } else {
      whatsappError = "WhatsApp not sent because invoice PDF is unavailable";

      console.log("WHATSAPP SKIPPED:", whatsappError);
    }

    // ==========================================
    // 20. SUCCESS RESPONSE
    // ==========================================

    return res.status(201).json({
      success: true,

      message: "Order created successfully",

      notifications: {
        invoiceGenerated: invoiceReady,
        invoiceUrl: order.invoicePdfUrl || null,

        smsSent: orderSmsSent,
        smsMessage: orderSmsSent
          ? "Order success SMS accepted by gateway"
          : orderSmsError,

        whatsappSent,
        whatsappMessage: whatsappSent
          ? "Order invoice WhatsApp accepted by gateway"
          : whatsappError,
      },

      data: order,
    });
  } catch (error) {
    // TRANSACTION ROLLBACK
    if (session?.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (rollbackError) {
        console.error(rollbackError.message);
      }
    }

    console.error("Create Order Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create order",
    });
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (sessionError) {
        console.error(sessionError.message);
      }
    }
  }
};
// exports.verifyRazorpayPayment = async (req, res) => {
//     console.time("VERIFY_PAYMENT_TOTAL");
//     try {
//         console.time("VERIFY_PAYMENT_DB_LOOKUP");
//         const userId = req.user?.userId;

//         const {
//             paymentAttemptId,
//             razorpay_order_id,
//             razorpay_payment_id,
//             razorpay_signature
//         } = req.body;

//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Please login first"
//             });
//         }

//         if (
//             !paymentAttemptId ||
//             !razorpay_order_id ||
//             !razorpay_payment_id ||
//             !razorpay_signature
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Required payment details are missing"
//             });
//         }

//         const attempt = await PaymentAttempt.findOne({
//             _id: paymentAttemptId,
//             user: userId,
//             razorpayOrderId: razorpay_order_id
//         });
//         console.timeEnd("VERIFY_PAYMENT_DB_LOOKUP");
//         if (!attempt) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Payment attempt not found"
//             });
//         }

//         // Return the existing order if already completed.
//         if (attempt.status === "ORDER_CREATED") {
//             return res.status(200).json({
//                 success: true,
//                 message: "Payment and order already completed",
//                 data: {
//                     paymentAttemptId: attempt._id,
//                     status: "ORDER_CREATED",
//                     orderId: attempt.order || null
//                 }
//             });
//         }

//         if (!["CREATED", "PAID"].includes(attempt.status)) {
//             return res.status(409).json({
//                 success: false,
//                 message: "This payment attempt cannot be processed",
//                 status: attempt.status
//             });
//         }

//         // Verify the Razorpay signature on the server.
//         const expectedSignature = crypto
//             .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//             .update(`${attempt.razorpayOrderId}|${razorpay_payment_id}`)
//             .digest("hex");

//         const expectedBuffer = Buffer.from(expectedSignature);
//         const receivedBuffer = Buffer.from(razorpay_signature);

//         if (
//             expectedBuffer.length !== receivedBuffer.length ||
//             !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid payment signature"
//             });
//         }
//         console.time("RAZORPAY_PAYMENT_FETCH");
//         // Confirm payment details directly with Razorpay.
//         const payment = await razorpay.payments.fetch(
//             razorpay_payment_id
//         );

//         if (
//             payment.order_id !== attempt.razorpayOrderId ||
//             payment.amount !== Math.round(attempt.amount * 100) ||
//             payment.currency !== attempt.currency
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Payment details do not match the payment attempt"
//             });
//         }

//         if (payment.status !== "captured") {
//             return res.status(409).json({
//                 success: false,
//                 message: "Payment is not captured yet",
//                 paymentStatus: payment.status
//             });
//         }

//         // Mark the payment as PAID.
//         if (attempt.status === "CREATED") {
//             const updatedAttempt = await PaymentAttempt.findOneAndUpdate(
//                 {
//                     _id: attempt._id,
//                     user: userId,
//                     status: "CREATED"
//                 },
//                 {
//                     $set: {
//                         status: "PAID",
//                         razorpayPaymentId: razorpay_payment_id
//                     }
//                 },
//                 { new: true }
//             );

//             if (!updatedAttempt) {
//                 const latest = await PaymentAttempt.findById(attempt._id);

//                 if (latest?.status === "ORDER_CREATED") {
//                     return res.status(200).json({
//                         success: true,
//                         message: "Order already created",
//                         data: {
//                             paymentAttemptId: latest._id,
//                             status: latest.status,
//                             orderId: latest.order || null
//                         }
//                     });
//                 }

//                 if (latest?.status !== "PAID") {
//                     return res.status(409).json({
//                         success: false,
//                         message: "Payment attempt is being processed",
//                         status: latest?.status
//                     });
//                 }
//             }
//         }
//         console.time("ORDER_LOOKUP");

//         // Recover if the order was created but the attempt was not updated.
//         let order = await Order.findOne({
//             razorpayOrderId: attempt.razorpayOrderId
//         });

//         if (!order) {
//             /*
//              * Build order items:
//              * - New cart attempts use attempt.items.
//              * - Older Buy Now attempts use product, variantId, quantity.
//              */
//             let orderItems = [];

//             if (Array.isArray(attempt.items) && attempt.items.length > 0) {
//                 orderItems = attempt.items.map(item => ({
//                     product: item.product,
//                     variant: item.variantId,
//                     quantity: item.quantity
//                 }));
//             } else if (
//                 attempt.product &&
//                 attempt.variantId &&
//                 Number(attempt.quantity) >= 1
//             ) {
//                 orderItems = [{
//                     product: attempt.product,
//                     variant: attempt.variantId,
//                     quantity: attempt.quantity
//                 }];
//             }

//             if (!orderItems.length) {
//                 console.error(
//                     "Payment attempt has no valid order items:",
//                     attempt._id
//                 );

//                 return res.status(500).json({
//                     success: false,
//                     message: "Payment verified, but order items could not be recovered",
//                     data: {
//                         paymentAttemptId: attempt._id,
//                         status: "PAID"
//                     }
//                 });
//             }

//             // Reuse existing createOrder, stock allocation and transaction logic.
//             let orderResponse;
//             let responseStatus = 200;

//             const internalReq = {
//                 user: req.user,
//                 body: {
//                     orderSource: "ONLINE",
//                     user: userId,
//                     address: attempt.address,
//                     items: orderItems,
//                     paymentMethod: "ONLINE",
//                     razorpayOrderId: attempt.razorpayOrderId,
//                     razorpayPaymentId: razorpay_payment_id
//                 }
//             };

//             const internalRes = {
//                 status(code) {
//                     responseStatus = code;
//                     return this;
//                 },
//                 json(body) {
//                     orderResponse = body;
//                     return this;
//                 }
//             };
//             console.time("CREATE_ORDER_TOTAL");
//             await exports.createOrder(internalReq, internalRes);
//             console.timeEnd("CREATE_ORDER_TOTAL");
//             if (
//                 responseStatus >= 400 ||
//                 !orderResponse?.success ||
//                 !orderResponse?.data?._id
//             ) {
//                 // A concurrent verification might already have created it.
//                 order = await Order.findOne({
//                     razorpayOrderId: attempt.razorpayOrderId
//                 });

//                 if (!order) {
//                     console.error(
//                         "Order creation after payment failed:",
//                         orderResponse
//                     );

//                     return res.status(500).json({
//                         success: false,
//                         message:
//                             orderResponse?.message ||
//                             "Payment verified, but order creation failed",
//                         data: {
//                             paymentAttemptId: attempt._id,
//                             status: "PAID"
//                         }
//                     });
//                 }
//             } else {
//                 // createOrder returns the order document in its response.
//                 order = orderResponse.data;
//             }
//         }

//         // Save the final order reference on the payment attempt.
//         const completedAttempt = await PaymentAttempt.findOneAndUpdate(
//             {
//                 _id: attempt._id,
//                 user: userId,
//                 status: "PAID"
//             },
//             {
//                 $set: {
//                     status: "ORDER_CREATED",
//                     razorpayPaymentId: razorpay_payment_id,
//                     order: order._id
//                 }
//             },
//             { new: true }
//         );

//         if (!completedAttempt) {
//             const latest = await PaymentAttempt.findById(attempt._id);

//             if (latest?.status !== "ORDER_CREATED") {
//                 return res.status(500).json({
//                     success: false,
//                     message: "Order exists, but payment attempt update is pending",
//                     data: {
//                         orderId: order._id,
//                         status: latest?.status
//                     }
//                 });
//             }
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Payment verified and order created successfully",
//             data: {
//                 paymentAttemptId: attempt._id,
//                 razorpayOrderId: attempt.razorpayOrderId,
//                 razorpayPaymentId: razorpay_payment_id,
//                 status: "ORDER_CREATED",
//                 orderId: order._id
//             }
//         });

//     } catch (error) {
//         console.error(
//             "Razorpay Verification / Order Creation Error:",
//             error
//         );

//         return res.status(500).json({
//             success: false,
//             message: "Payment was received, but order processing needs attention"
//         });
//     }
// };

// ======================================================
// CREATE ORDER
// ======================================================

// exports.createOrder = async (req, res) => {

//     const session = await mongoose.startSession();

//     session.startTransaction();

//     try {

//         // ==================================================
//         // 1. BASIC VALIDATION
//         // ==================================================

//         const {
//             orderSource,
//             user: userId,
//             address: addressId,
//             items,
//             paymentMethod,
//             razorpayOrderId,
//             razorpayPaymentId,
//             branch,
//             subBranch,
//             createdBy,

//             customerDetails,

//             discountAmount = 0,
//             couponCode = "",
//             shippingCharge = 0,
//             gstAmount = 0
//         } = req.body;
//         if (razorpayOrderId) {
//             const existingOrder = await Order.findOne({
//                 razorpayOrderId
//             }).session(session);

//             if (existingOrder) {
//                 await session.abortTransaction();
//                 session.endSession();

//                 return res.status(200).json({
//                     success: true,
//                     message: "Order already exists for this payment",
//                     data: existingOrder
//                 });
//             }
//         }

//         if (!orderSource) {
//             throw new Error("Order source is required");
//         }

//         if (
//             !["ONLINE", "BRANCH", "SUB_BRANCH"]
//                 .includes(orderSource)
//         ) {
//             throw new Error("Invalid order source");
//         }

//         if (!paymentMethod) {
//             throw new Error("Payment method is required");
//         }

//         if (!items) {
//             throw new Error("Order items are required");
//         }

//         // ==================================================
//         // 2. PARSE ITEMS
//         // ==================================================

//         let parsedItems = items;

//         if (typeof items === "string") {
//             try {
//                 parsedItems = JSON.parse(items);
//             } catch (error) {
//                 throw new Error("Invalid items JSON");
//             }
//         }

//         if (
//             !Array.isArray(parsedItems) ||
//             parsedItems.length === 0
//         ) {
//             throw new Error(
//                 "At least one order item is required"
//             );
//         }

//         // ==================================================
//         // 3. CUSTOMER VALIDATION
//         // ==================================================

//         let user = null;
//         let address = null;

//         if (orderSource === "ONLINE") {

//             if (!userId) {
//                 throw new Error(
//                     "User is required for online order"
//                 );
//             }

//             if (!addressId) {
//                 throw new Error(
//                     "Address is required for online order"
//                 );
//             }

//             user = await User.findById(userId)
//                 .session(session);

//             if (!user) {
//                 throw new Error("User not found");
//             }

//             address = await Address.findById(addressId)
//                 .session(session);

//             if (!address) {
//                 throw new Error("Address not found");
//             }
//         }

//         // ==================================================
//         // 4. BRANCH / SUB-BRANCH VALIDATION
//         // ==================================================

//         let branchAdmin = null;
//         let subBranchAdmin = null;
//         let createdByAdmin = null;

//         if (orderSource === "BRANCH") {

//             if (!branch) {
//                 throw new Error(
//                     "Branch is required"
//                 );
//             }

//             branchAdmin = await Admin.findById(branch)
//                 .session(session);

//             if (!branchAdmin) {
//                 throw new Error(
//                     "Branch admin not found"
//                 );
//             }
//         }

//         if (orderSource === "SUB_BRANCH") {

//             if (!subBranch) {
//                 throw new Error(
//                     "Sub branch is required"
//                 );
//             }

//             subBranchAdmin = await Admin.findById(subBranch)
//                 .session(session);

//             if (!subBranchAdmin) {
//                 throw new Error(
//                     "Sub branch admin not found"
//                 );
//             }
//         }

//         if (createdBy) {

//             createdByAdmin = await Admin.findById(createdBy)
//                 .session(session);

//             if (!createdByAdmin) {
//                 throw new Error(
//                     "Created by admin not found"
//                 );
//             }
//         }

//         // ==================================================
//         // 5. GENERATE ORDER NUMBER
//         // ==================================================

//         const timestamp = Date.now();

//         const orderNumber =
//             `ORD-${timestamp}`;

//         const invoiceNumber =
//             `INV-${timestamp}`;

//         // ==================================================
//         // 6. ADDRESS SNAPSHOT
//         // ==================================================

//         let addressSnapshot = null;

//         if (address) {

//             addressSnapshot = {

//                 fullName: address.fullName,

//                 phone: address.phone,

//                 alternatePhone:
//                     address.alternatePhone,

//                 addressLine1:
//                     address.addressLine1,

//                 addressLine2:
//                     address.addressLine2,

//                 landmark:
//                     address.landmark,

//                 city:
//                     address.city,

//                 state:
//                     address.state,

//                 country:
//                     address.country,

//                 postalCode:
//                     address.postalCode
//             };
//         }

//         // ==================================================
//         // 7. PREPARE ORDER ITEMS
//         // ==================================================

//         const orderItems = [];

//         let subTotal = 0;
//         let totalDiscount = Number(discountAmount) || 0;
//         let totalGst = Number(gstAmount) || 0;

//         // ==================================================
//         // 8. PROCESS EVERY ITEM
//         // ==================================================

//         for (const item of parsedItems) {

//             if (!item.product) {
//                 throw new Error(
//                     "Product is required"
//                 );
//             }

//             if (!item.variant) {
//                 throw new Error(
//                     "Variant is required"
//                 );
//             }

//             const quantity =
//                 Number(item.quantity) || 1;

//             if (quantity <= 0) {
//                 throw new Error(
//                     "Quantity must be greater than zero"
//                 );
//             }

//             // ==============================================
//             // LOAD PRODUCT
//             // ==============================================

//             const product =
//                 await Product.findById(item.product)
//                     .session(session);

//             if (!product) {
//                 throw new Error(
//                     `Product not found: ${item.product}`
//                 );
//             }

//             // ==============================================
//             // FIND EMBEDDED VARIANT
//             // ==============================================

//             const variant =
//                 product.variants.find(
//                     v =>
//                         v._id.toString() ===
//                         item.variant.toString()
//                 );

//             if (!variant) {
//                 throw new Error(
//                     `Variant not found for product ${product.name}`
//                 );
//             }

//             // ==============================================
//             // PRODUCT STOCK CHECK
//             // ==============================================

//             if (
//                 Number(variant.stock) <
//                 quantity
//             ) {
//                 throw new Error(
//                     `Insufficient stock for ${product.name}`
//                 );
//             }

//             // ==============================================
//             // CALCULATE PRICE
//             // ==============================================

//             const priceDetails =
//                 await calculateVariantPrice(variant);

//             if (!priceDetails) {
//                 throw new Error(
//                     `Unable to calculate price for ${product.name}`
//                 );
//             }

//             const unitPrice =
//                 Number(
//                     priceDetails.finalPrice
//                 ) || 0;

//             const totalPrice =
//                 unitPrice * quantity;

//             // ==============================================
//             // STONE WEIGHT
//             // ==============================================

//             const stoneWeight =
//                 variant.stones?.reduce(
//                     (total, stone) =>
//                         total +
//                         (
//                             Number(stone.totalWeight) ||
//                             0
//                         ),
//                     0
//                 ) || 0;

//             // ==============================================
//             // DIAMOND WEIGHT
//             // ==============================================

//             const diamondWeight =
//                 variant.stones
//                     ?.filter(
//                         stone =>
//                             stone.stoneType ===
//                             "diamond"
//                     )
//                     .reduce(
//                         (total, stone) =>
//                             total +
//                             (
//                                 Number(
//                                     stone.totalWeight
//                                 ) || 0
//                             ),
//                         0
//                     ) || 0;

//             // ==============================================
//             // PRODUCT SNAPSHOT
//             // ==============================================

//             const productSnapshot = {

//                 name: product.name,

//                 slug: product.slug,

//                 image:
//                     product.images?.[0] || null,

//                 category:
//                     product.category?.toString() ||
//                     null,

//                 subCategory:
//                     product.subCategory?.toString() ||
//                     null,

//                 subSubCategory:
//                     product.subSubCategory?.toString() ||
//                     null,

//                 productType:
//                     product.productType,

//                 brand:
//                     product.brand || ""
//             };

//             // ==============================================
//             // STONES SNAPSHOT
//             // ==============================================

//             const stonesSnapshot =
//                 variant.stones?.map(stone => ({

//                     stoneType:
//                         stone.stoneType,

//                     stoneCategory:
//                         stone.stoneCategory,

//                     quality:
//                         stone.quality,

//                     quantity:
//                         Number(stone.quantity) || 0,

//                     totalWeight:
//                         Number(
//                             stone.totalWeight
//                         ) || 0,

//                     // Calculator may return stone value
//                     stoneValue:
//                         Number(
//                             stone.stoneValue
//                         ) || 0

//                 })) || [];

//             // ==============================================
//             // VARIANT SNAPSHOT
//             // ==============================================

//             const variantSnapshot = {

//                 sku:
//                     variant.sku,

//                 metalType:
//                     variant.metalType,

//                 purity:
//                     variant.metalPurity,

//                 metalColor:
//                     variant.metalColor,

//                 size:
//                     variant.size,

//                 grossWeight:
//                     Number(
//                         variant.grossWeight
//                     ) || 0,

//                 netWeight:
//                     Number(
//                         variant.netWeight
//                     ) || 0,

//                 wastagePercentage:
//                     Number(
//                         variant.wastagePercentage
//                     ) || 0,

//                 stoneWeight,

//                 diamondWeight,

//                 makingCharge:
//                     Number(
//                         variant.makingCharges
//                     ) || 0,

//                 makingChargeType:
//                     variant.makingChargeType,

//                 discountPercentage:
//                     Number(
//                         variant.discountPercentage
//                     ) || 0,

//                 stoneType:
//                     stonesSnapshot?.[0]?.stoneType ||
//                     null,

//                 gender:
//                     product.gender || null,

//                 stones:
//                     stonesSnapshot
//             };

//             // ==============================================
//             // PRICING SNAPSHOT
//             // ==============================================

//             const pricingSnapshot = {

//                 goldRate:
//                     Number(
//                         priceDetails.goldRate
//                     ) || 0,

//                 goldValue:
//                     Number(
//                         priceDetails.goldValue
//                     ) || 0,

//                 wastageAmount:
//                     Number(
//                         priceDetails.wastageAmount
//                     ) || 0,

//                 stoneValue:
//                     Number(
//                         priceDetails.stoneValue
//                     ) || 0,

//                 diamondValue:
//                     Number(
//                         priceDetails.diamondValue
//                     ) || 0,

//                 makingCharge:
//                     Number(
//                         priceDetails.makingCharge
//                     ) || 0,

//                 discountAmount:
//                     Number(
//                         priceDetails.discountAmount
//                     ) || 0,

//                 gstPercentage:
//                     Number(
//                         priceDetails.gstPercentage
//                     ) || 0,

//                 gstAmount:
//                     Number(
//                         priceDetails.gstAmount
//                     ) || 0,

//                 finalPrice:
//                     unitPrice
//             };

//             // ==============================================
//             // SOURCE STOCK ALLOCATION
//             // ==============================================
//             //
//             // FIFO:
//             // Oldest available stock first.
//             //
//             // Supplier purchase date / maker production
//             // issue date based ordering can be applied here.

//             let remainingQuantity =
//                 quantity;

//             const stockAllocations = [];

//             // ==============================================
//             // SUPPLIER STOCK
//             // ==============================================

//             const supplierItems =
//                 await SupplierPurchaseItem
//                     .find({
//                         product: product._id,

//                         variantId: variant._id,

//                         availableQuantity: {
//                             $gt: 0
//                         }
//                     })
//                     .populate({
//                         path: "purchase",
//                         select: "purchaseDate invoiceNumber"
//                     })
//                     .sort({
//                         createdAt: 1
//                     })
//                     .session(session);

//             for (
//                 const supplierItem
//                 of supplierItems
//             ) {

//                 if (remainingQuantity <= 0) {
//                     break;
//                 }

//                 const available =
//                     Number(
//                         supplierItem.availableQuantity
//                     ) || 0;

//                 if (available <= 0) {
//                     continue;
//                 }

//                 const allocateQuantity =
//                     Math.min(
//                         remainingQuantity,
//                         available
//                     );

//                 supplierItem.availableQuantity =
//                     available -
//                     allocateQuantity;

//                 await supplierItem.save({
//                     session
//                 });

//                 stockAllocations.push({

//                     sourceType:
//                         "SUPPLIER",

//                     supplierPurchaseItem:
//                         supplierItem._id,

//                     makerProductionItem:
//                         null,

//                     quantity:
//                         allocateQuantity
//                 });

//                 remainingQuantity -=
//                     allocateQuantity;
//             }

//             // ==============================================
//             // MAKER STOCK
//             // ==============================================

//             if (remainingQuantity > 0) {

//                 const makerItems =
//                     await MakerProductionItem
//                         .find({
//                             product: product._id,

//                             variantId: variant._id,

//                             availableQuantity: {
//                                 $gt: 0
//                             }
//                         })
//                         .populate({
//                             path: "production",
//                             select:
//                                 "issueDate productionNumber"
//                         })
//                         .sort({
//                             createdAt: 1
//                         })
//                         .session(session);

//                 for (
//                     const makerItem
//                     of makerItems
//                 ) {

//                     if (
//                         remainingQuantity <= 0
//                     ) {
//                         break;
//                     }

//                     const available =
//                         Number(
//                             makerItem.availableQuantity
//                         ) || 0;

//                     if (available <= 0) {
//                         continue;
//                     }

//                     const allocateQuantity =
//                         Math.min(
//                             remainingQuantity,
//                             available
//                         );

//                     makerItem.availableQuantity =
//                         available -
//                         allocateQuantity;

//                     await makerItem.save({
//                         session
//                     });

//                     stockAllocations.push({

//                         sourceType:
//                             "MAKER",

//                         supplierPurchaseItem:
//                             null,

//                         makerProductionItem:
//                             makerItem._id,

//                         quantity:
//                             allocateQuantity
//                     });

//                     remainingQuantity -=
//                         allocateQuantity;
//                 }
//             }

//             // ==============================================
//             // FINAL SOURCE STOCK VALIDATION
//             // ==============================================

//             if (remainingQuantity > 0) {

//                 throw new Error(
//                     `Source stock unavailable for ${product.name} - SKU ${variant.sku}`
//                 );
//             }

//             // ==============================================
//             // DECREASE PRODUCT AGGREGATE STOCK
//             // ==============================================

//             variant.stock =
//                 Number(variant.stock) -
//                 quantity;

//             if (variant.stock < 0) {

//                 throw new Error(
//                     `Invalid stock calculation for ${product.name}`
//                 );
//             }

//             await product.save({
//                 session
//             });

//             // ==============================================
//             // CREATE ORDER ITEM
//             // ==============================================

//             orderItems.push({

//                 product:
//                     product._id,

//                 variant:
//                     variant._id,

//                 productSnapshot,

//                 stockAllocations,

//                 variantSnapshot,

//                 pricingSnapshot,

//                 quantity,

//                 unitPrice,

//                 totalPrice
//             });

//             // ==============================================
//             // TOTALS
//             // ==============================================

//             subTotal += totalPrice;

//             totalGst +=
//                 Number(
//                     priceDetails.gstAmount
//                 ) *
//                 quantity;
//         }

//         // ==================================================
//         // 9. CALCULATE FINAL TOTAL
//         // ==================================================

//         const finalTotal =
//             subTotal -
//             totalDiscount +
//             Number(shippingCharge || 0);

//         if (finalTotal < 0) {

//             throw new Error(
//                 "Invalid order total"
//             );
//         }

//         // ==================================================
//         // 10. PAYMENT STATUS
//         // ==================================================

//         let paymentStatus = "Pending";

//         if (
//             paymentMethod === "CASH" ||
//             paymentMethod === "UPI" ||
//             paymentMethod === "CARD" ||
//             paymentMethod === "ONLINE" ||
//             paymentMethod === "NETBANKING"
//         ) {
//             paymentStatus = "Paid";
//         }

//         if (
//             paymentMethod === "COD"
//         ) {
//             paymentStatus = "Pending";
//         }

//         // ==================================================
//         // 11. ORDER STATUS
//         // ==================================================

//         const orderStatus =
//             "Confirmed";

//         // ==================================================
//         // 12. CUSTOMER DETAILS
//         // ==================================================

//         let finalCustomerDetails =
//             customerDetails || {};

//         if (user) {

//             finalCustomerDetails = {

//                 name:
//                     customerDetails?.name ||
//                     user.name ||
//                     "",

//                 phone:
//                     customerDetails?.phone ||
//                     user.phone ||
//                     "",

//                 email:
//                     customerDetails?.email ||
//                     user.email ||
//                     ""
//             };
//         }

//         // ==================================================
//         // 13. CREATE ORDER
//         // ==================================================

//         const order =
//             new Order({

//                 orderNumber,

//                 invoiceNumber,

//                 orderSource,

//                 branch:
//                     branch || null,

//                 subBranch:
//                     subBranch || null,

//                 createdBy:
//                     createdBy || null,

//                 user:
//                     user?._id || null,

//                 customerDetails:
//                     finalCustomerDetails,

//                 items:
//                     orderItems,

//                 address:
//                     address?._id || null,

//                 addressSnapshot,

//                 paymentMethod,

//                 paymentStatus,

//                 subTotal,

//                 discountAmount:
//                     totalDiscount,

//                 couponCode,

//                 shippingCharge:
//                     Number(shippingCharge) || 0,

//                 gstAmount:
//                     totalGst,

//                 totalAmount:
//                     finalTotal,

//                 orderStatus,

//                 billingStatus:
//                     "Completed",

//                 statusHistory: [{

//                     status:
//                         orderStatus,

//                     updatedBy:
//                         createdBy || null,

//                     remarks:
//                         "Order created",

//                     updatedAt:
//                         new Date()
//                 }],

//                 invoiceDate:
//                     new Date(),

//                 stockUpdated:
//                     true,
//                 razorpayOrderId: razorpayOrderId || null,
//                 razorpayPaymentId: razorpayPaymentId || null,
//                 paymentHistory: razorpayPaymentId
//                     ? [{
//                         method: "ONLINE",
//                         amount: finalTotal,
//                         transactionId: razorpayPaymentId,
//                         paymentGateway: "Razorpay",
//                         paidAt: new Date()
//                     }]
//                     : [],

//             });

//         await order.save({
//             session
//         });

//         // ==================================================
//         // 14. COMMIT TRANSACTION
//         // ==================================================

//         await session.commitTransaction();

//         session.endSession();

//         // ==================================================
//         // 15. SEND INVOICE EMAIL
//         // ==================================================
//         // Email fail ayina order rollback avvakudadhu.
//         // Order already successfully created.

//         if (
//             user?.email &&
//             orderSource === "ONLINE"
//         ) {

//             try {

//                 await sendInvoiceEmail(
//                     user.email,
//                     order
//                 );

//             } catch (emailError) {

//                 console.error(
//                     "Invoice email failed:",
//                     emailError.message
//                 );
//             }
//         }

//         // ==================================================
//         // 16. RESPONSE
//         // ==================================================

//         return res.status(201).json({

//             success: true,

//             message:
//                 "Order created successfully",

//             data:
//                 order

//         });

//     } catch (error) {

//         // ==================================================
//         // ROLLBACK
//         // ==================================================

//         await session.abortTransaction();

//         session.endSession();

//         console.error(
//             "Create Order Error:",
//             error
//         );

//         return res.status(400).json({

//             success: false,

//             message:
//                 error.message ||
//                 "Failed to create order"

//         });
//     }
// };

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
            $options: "i",
          },
        },

        {
          invoiceNumber: {
            $regex: search,
            $options: "i",
          },
        },

        {
          "customerDetails.name": {
            $regex: search,
            $options: "i",
          },
        },

        {
          "customerDetails.phone": {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    // ==================================================
    // OPTIONAL FILTERS
    // ==================================================

    if (req.query.orderStatus) {
      query.orderStatus = req.query.orderStatus;
    }

    if (req.query.paymentStatus) {
      query.paymentStatus = req.query.paymentStatus;
    }

    if (req.query.orderSource) {
      query.orderSource = req.query.orderSource;
    }

    // ==================================================
    // TOTAL COUNT
    // ==================================================

    const totalOrders = await Order.countDocuments(query);

    // ==================================================
    // GET ORDERS
    // ==================================================

    const orders = await Order.find(query)

      // ------------------------------------------
      // CUSTOMER
      // ------------------------------------------

      .populate({
        path: "user",
        select: "name email phone",
      })
      .populate({
        path: "items.product",
        select: "name slug images",
      })
      // ------------------------------------------
      // BRANCH
      // ------------------------------------------

      .populate({
        path: "branch",
        select: "name email phone role",
      })

      // ------------------------------------------
      // SUB BRANCH
      // ------------------------------------------

      .populate({
        path: "subBranch",
        select: "name email phone role",
      })

      // ------------------------------------------
      // CREATED BY
      // ------------------------------------------

      .populate({
        path: "createdBy",
        select: "name email phone role",
      })

      // ------------------------------------------
      // ADDRESS
      // ------------------------------------------

      .populate({
        path: "address",
      })

      // ------------------------------------------
      // SUPPLIER PURCHASE ITEM
      // ------------------------------------------

      .populate({
        path: "items.stockAllocations.supplierPurchaseItem",

        select:
          "purchase supplierProductCode batchNumber quantity availableQuantity purchasePrice discount tax totalAmount notes",

        populate: {
          path: "purchase",

          select:
            "supplier invoiceNumber invoiceDate purchaseDate status paymentStatus",

          populate: {
            path: "supplier",

            select: "name companyName phone email gstNumber address",
          },
        },
      })

      // ------------------------------------------
      // MAKER PRODUCTION ITEM
      // ------------------------------------------

      .populate({
        path: "items.stockAllocations.makerProductionItem",

        select:
          "production quantityGiven quantityReceived availableQuantity notes",

        populate: {
          path: "production",

          select:
            "maker productionNumber issueDate expectedDate receivedDate status notes",

          populate: {
            path: "maker",

            select: "name phone email address specialization notes",
          },
        },
      })

      // ------------------------------------------
      // SORT
      // ------------------------------------------

      .sort({
        createdAt: -1,
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

    const formattedOrders = orders.map((order) => {
      const orderObj = order.toObject();

      orderObj.items = orderObj.items.map((item) => {
        item.stockAllocations = item.stockAllocations?.map((allocation) => {
          // ==================================
          // SUPPLIER SOURCE
          // ==================================

          if (allocation.sourceType === "SUPPLIER") {
            const supplierItem = allocation.supplierPurchaseItem;

            const purchase = supplierItem?.purchase;

            const supplier = purchase?.supplier;

            return {
              ...allocation,

              sourceDetails: {
                sourceType: "SUPPLIER",

                supplierPurchaseItemId: supplierItem?._id || null,

                supplier: supplier
                  ? {
                      _id: supplier._id,

                      name: supplier.name,

                      companyName: supplier.companyName,

                      phone: supplier.phone,

                      email: supplier.email,

                      gstNumber: supplier.gstNumber,

                      address: supplier.address,
                    }
                  : null,

                purchase: purchase
                  ? {
                      _id: purchase._id,

                      invoiceNumber: purchase.invoiceNumber,

                      invoiceDate: purchase.invoiceDate,

                      purchaseDate: purchase.purchaseDate,

                      status: purchase.status,

                      paymentStatus: purchase.paymentStatus,
                    }
                  : null,

                supplierProductCode: supplierItem?.supplierProductCode || "",

                batchNumber: supplierItem?.batchNumber || "",

                allocatedQuantity: allocation.quantity,
              },
            };
          }

          // ==================================
          // MAKER SOURCE
          // ==================================

          if (allocation.sourceType === "MAKER") {
            const makerItem = allocation.makerProductionItem;

            const production = makerItem?.production;

            const maker = production?.maker;

            return {
              ...allocation,

              sourceDetails: {
                sourceType: "MAKER",

                makerProductionItemId: makerItem?._id || null,

                maker: maker
                  ? {
                      _id: maker._id,

                      name: maker.name,

                      phone: maker.phone,

                      email: maker.email,

                      specialization: maker.specialization,

                      address: maker.address,
                    }
                  : null,

                production: production
                  ? {
                      _id: production._id,

                      productionNumber: production.productionNumber,

                      issueDate: production.issueDate,

                      expectedDate: production.expectedDate,

                      receivedDate: production.receivedDate,

                      status: production.status,
                    }
                  : null,

                allocatedQuantity: allocation.quantity,
              },
            };
          }

          return allocation;
        });

        return item;
      });

      return orderObj;
    });

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Orders fetched successfully",

      data: formattedOrders,

      pagination: {
        currentPage: page,

        totalPages: Math.ceil(totalOrders / limit),

        totalOrders,

        limit,

        hasNextPage: page < Math.ceil(totalOrders / limit),

        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get All Orders Error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to fetch orders",
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

        message: "Order ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid order ID",
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
        select: "name email phone",
      })

      // ------------------------------------------
      // BRANCH
      // ------------------------------------------

      .populate({
        path: "branch",
        select: "name email phone role",
      })

      // ------------------------------------------
      // SUB BRANCH
      // ------------------------------------------

      .populate({
        path: "subBranch",
        select: "name email phone role",
      })

      // ------------------------------------------
      // CREATED BY
      // ------------------------------------------

      .populate({
        path: "createdBy",
        select: "name email phone role",
      })
      .populate({
        path: "items.product",
        select: "name slug images",
      })
      // ------------------------------------------
      // ADDRESS
      // ------------------------------------------

      .populate({
        path: "address",
      })

      // ==================================================
      // SUPPLIER STOCK SOURCE
      // ==================================================

      .populate({
        path: "items.stockAllocations.supplierPurchaseItem",

        select:
          "purchase supplierProductCode batchNumber quantity availableQuantity purchasePrice discount tax totalAmount notes",

        populate: {
          path: "purchase",

          select:
            "supplier invoiceNumber invoiceDate purchaseDate status paymentStatus",

          populate: {
            path: "supplier",

            select: "name companyName phone email gstNumber address",
          },
        },
      })

      // ==================================================
      // MAKER STOCK SOURCE
      // ==================================================

      .populate({
        path: "items.stockAllocations.makerProductionItem",

        select:
          "production quantityGiven quantityReceived availableQuantity notes",

        populate: {
          path: "production",

          select:
            "maker productionNumber issueDate expectedDate receivedDate status notes",

          populate: {
            path: "maker",

            select: "name phone email address specialization notes",
          },
        },
      });

    // ==================================================
    // 3. ORDER NOT FOUND
    // ==================================================

    if (!order) {
      return res.status(404).json({
        success: false,

        message: "Order not found",
      });
    }

    // ==================================================
    // 4. CONVERT TO OBJECT
    // ==================================================

    const orderObj = order.toObject();

    // ==================================================
    // 5. FORMAT STOCK SOURCE INFORMATION
    // ==================================================

    orderObj.items = orderObj.items.map((item) => {
      item.stockAllocations =
        item.stockAllocations?.map((allocation) => {
          // ==================================================
          // SUPPLIER
          // ==================================================

          if (allocation.sourceType === "SUPPLIER") {
            const supplierItem = allocation.supplierPurchaseItem;

            const purchase = supplierItem?.purchase;

            const supplier = purchase?.supplier;

            return {
              ...allocation,

              sourceDetails: {
                sourceType: "SUPPLIER",

                supplierPurchaseItemId: supplierItem?._id || null,

                // ----------------------------------
                // SUPPLIER DETAILS
                // ----------------------------------

                supplier: supplier
                  ? {
                      _id: supplier._id,

                      name: supplier.name,

                      companyName: supplier.companyName,

                      phone: supplier.phone,

                      email: supplier.email,

                      gstNumber: supplier.gstNumber,

                      address: supplier.address,
                    }
                  : null,

                // ----------------------------------
                // PURCHASE DETAILS
                // ----------------------------------

                purchase: purchase
                  ? {
                      _id: purchase._id,

                      invoiceNumber: purchase.invoiceNumber,

                      invoiceDate: purchase.invoiceDate,

                      purchaseDate: purchase.purchaseDate,

                      status: purchase.status,

                      paymentStatus: purchase.paymentStatus,
                    }
                  : null,

                // ----------------------------------
                // SUPPLIER PRODUCT INFO
                // ----------------------------------

                supplierProductCode: supplierItem?.supplierProductCode || "",

                batchNumber: supplierItem?.batchNumber || "",

                // ----------------------------------
                // ORDER ALLOCATED QTY
                // ----------------------------------

                allocatedQuantity: allocation.quantity,
              },
            };
          }

          // ==================================================
          // MAKER
          // ==================================================

          if (allocation.sourceType === "MAKER") {
            const makerItem = allocation.makerProductionItem;

            const production = makerItem?.production;

            const maker = production?.maker;

            return {
              ...allocation,

              sourceDetails: {
                sourceType: "MAKER",

                makerProductionItemId: makerItem?._id || null,

                // ----------------------------------
                // MAKER DETAILS
                // ----------------------------------

                maker: maker
                  ? {
                      _id: maker._id,

                      name: maker.name,

                      phone: maker.phone,

                      email: maker.email,

                      specialization: maker.specialization,

                      address: maker.address,
                    }
                  : null,

                // ----------------------------------
                // PRODUCTION DETAILS
                // ----------------------------------

                production: production
                  ? {
                      _id: production._id,

                      productionNumber: production.productionNumber,

                      issueDate: production.issueDate,

                      expectedDate: production.expectedDate,

                      receivedDate: production.receivedDate,

                      status: production.status,

                      notes: production.notes,
                    }
                  : null,

                // ----------------------------------
                // ORDER ALLOCATED QTY
                // ----------------------------------

                allocatedQuantity: allocation.quantity,
              },
            };
          }

          // ==================================================
          // UNKNOWN SOURCE
          // ==================================================

          return allocation;
        }) || [];

      return item;
    });

    // ==================================================
    // 6. RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "Order fetched successfully",

      data: orderObj,
    });
  } catch (error) {
    console.error("Get Order By ID Error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to fetch order",
    });
  }
};
// get order by user

exports.getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await Order.find({
      user: userId,
    })

      // CUSTOMER DETAILS
      .populate("user", "name phone email")

      // PRODUCT DETAILS WITH IMAGES
      .populate({
        path: "items.product",
        select: "name slug images variants._id variants.metalPurity",
      })

      // ADDRESS DETAILS
      .populate("address")

      // STATUS UPDATED BY
      .populate("statusHistory.updatedBy", "name role")

      // LATEST ORDERS FIRST
      .sort({ createdAt: -1 });

    if (!orders.length) {
      return res.status(404).json({
        success: false,

        message: "No orders found",
      });
    }

    res.status(200).json({
      success: true,

      count: orders.length,

      data: orders,
    });
  } catch (error) {
    console.error("Get Orders By User Error:", error);

    res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// gey branch by order
exports.getBranchOrders = async (req, res) => {
  try {
    const { branchId } = req.params;

    const orders = await Order.find({
      branch: branchId,
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

        message: "No orders found",
      });
    }

    res.status(200).json({
      success: true,

      count: orders.length,

      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

// get sub branch

exports.getSubBranchOrders = async (req, res) => {
  try {
    const { subBranchId } = req.params;

    const orders = await Order.find({
      subBranch: subBranchId,
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

        message: "No orders found",
      });
    }

    res.status(200).json({
      success: true,

      count: orders.length,

      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,

      message: error.message,
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
        message: "Product, Variant and Quantity are required.",
      });
    }

    const productData = await Product.findById(product);

    if (!productData) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const variantData = productData.variants.id(variant);

    if (!variantData) {
      return res.status(404).json({
        success: false,
        message: "Variant not found.",
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

        totalPrice: price.finalPrice * quantity,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
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
        message: "Order not found.",
      });
    }

    // Delete Order
    await Order.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully.",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getOrdersBySource = async (req, res, orderSource) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";

    const query = {
      orderSource,
    };

    if (search) {
      query.$or = [
        {
          orderNumber: {
            $regex: search,
            $options: "i",
          },
        },
        {
          invoiceNumber: {
            $regex: search,
            $options: "i",
          },
        },
        {
          "customerDetails.name": {
            $regex: search,
            $options: "i",
          },
        },
        {
          "customerDetails.phone": {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (req.query.orderStatus) {
      query.orderStatus = req.query.orderStatus;
    }

    if (req.query.paymentStatus) {
      query.paymentStatus = req.query.paymentStatus;
    }

    // Branch orders lo specific branch filter
    if (orderSource === "BRANCH" && req.query.branch) {
      query.branch = req.query.branch;
    }

    // Sub branch orders lo specific sub branch filter
    if (orderSource === "SUB_BRANCH" && req.query.subBranch) {
      query.subBranch = req.query.subBranch;
    }

    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate({
        path: "user",
        select: "name email phone",
      })
      .populate({
        path: "items.product",
        select: "name slug images",
      })
      .populate({
        path: "branch",
        select: "name email phone role",
      })
      .populate({
        path: "subBranch",
        select: "name email phone role",
      })
      .populate({
        path: "createdBy",
        select: "name email phone role",
      })
      .populate({
        path: "address",
      })
      .populate({
        path: "items.stockAllocations.supplierPurchaseItem",
        select:
          "purchase supplierProductCode batchNumber quantity availableQuantity purchasePrice discount tax totalAmount notes",
        populate: {
          path: "purchase",
          select:
            "supplier invoiceNumber invoiceDate purchaseDate status paymentStatus",
          populate: {
            path: "supplier",
            select: "name companyName phone email gstNumber address",
          },
        },
      })
      .populate({
        path: "items.stockAllocations.makerProductionItem",
        select:
          "production quantityGiven quantityReceived availableQuantity notes",
        populate: {
          path: "production",
          select:
            "maker productionNumber issueDate expectedDate receivedDate status notes",
          populate: {
            path: "maker",
            select: "name phone email address specialization notes",
          },
        },
      })
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit);

    const formattedOrders = orders.map((order) => {
      const orderObj = order.toObject();

      orderObj.items = orderObj.items.map((item) => {
        item.stockAllocations = item.stockAllocations?.map((allocation) => {
          if (allocation.sourceType === "SUPPLIER") {
            const supplierItem = allocation.supplierPurchaseItem;
            const purchase = supplierItem?.purchase;
            const supplier = purchase?.supplier;

            return {
              ...allocation,

              sourceDetails: {
                sourceType: "SUPPLIER",
                supplierPurchaseItemId: supplierItem?._id || null,

                supplier: supplier
                  ? {
                      _id: supplier._id,
                      name: supplier.name,
                      companyName: supplier.companyName,
                      phone: supplier.phone,
                      email: supplier.email,
                      gstNumber: supplier.gstNumber,
                      address: supplier.address,
                    }
                  : null,

                purchase: purchase
                  ? {
                      _id: purchase._id,
                      invoiceNumber: purchase.invoiceNumber,
                      invoiceDate: purchase.invoiceDate,
                      purchaseDate: purchase.purchaseDate,
                      status: purchase.status,
                      paymentStatus: purchase.paymentStatus,
                    }
                  : null,

                supplierProductCode: supplierItem?.supplierProductCode || "",
                batchNumber: supplierItem?.batchNumber || "",
                allocatedQuantity: allocation.quantity,
              },
            };
          }

          if (allocation.sourceType === "MAKER") {
            const makerItem = allocation.makerProductionItem;
            const production = makerItem?.production;
            const maker = production?.maker;

            return {
              ...allocation,

              sourceDetails: {
                sourceType: "MAKER",
                makerProductionItemId: makerItem?._id || null,

                maker: maker
                  ? {
                      _id: maker._id,
                      name: maker.name,
                      phone: maker.phone,
                      email: maker.email,
                      specialization: maker.specialization,
                      address: maker.address,
                    }
                  : null,

                production: production
                  ? {
                      _id: production._id,
                      productionNumber: production.productionNumber,
                      issueDate: production.issueDate,
                      expectedDate: production.expectedDate,
                      receivedDate: production.receivedDate,
                      status: production.status,
                    }
                  : null,

                allocatedQuantity: allocation.quantity,
              },
            };
          }

          return allocation;
        });

        return item;
      });

      return orderObj;
    });

    return res.status(200).json({
      success: true,
      message: `${orderSource} orders fetched successfully`,
      data: formattedOrders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        limit,
        hasNextPage: page < Math.ceil(totalOrders / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get Orders By Source Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders",
    });
  }
};

exports.getCustomerOrders = async (req, res) => {
  await getOrdersBySource(req, res, "ONLINE");
};

exports.getAllBranchOrders = async (req, res) => {
  await getOrdersBySource(req, res, "BRANCH");
};

exports.getAllSubBranchOrders = async (req, res) => {
  await getOrdersBySource(req, res, "SUB_BRANCH");
};

exports.createPosRazorpayOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !["BRANCH", "SUB_BRANCH"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Only Branch and Sub-Branch users can initiate POS payments",
      });
    }

    const { items, customerDetails } = req.body;

    // 1. Validate logged-in Admin
    const admin = await Admin.findById(userId);

    if (!admin || !admin.isActive || admin.role !== role) {
      return res.status(403).json({
        success: false,
        message: "Invalid or inactive branch account",
      });
    }

    let branchId = null;
    let subBranchId = null;

    if (role === "BRANCH") {
      branchId = admin._id;
    } else {
      if (!admin.branchId) {
        return res.status(400).json({
          success: false,
          message: "Parent branch not assigned to this Sub-Branch",
        });
      }

      const parentBranch = await Admin.findOne({
        _id: admin.branchId,
        role: "BRANCH",
        isActive: true,
      });

      if (!parentBranch) {
        return res.status(400).json({
          success: false,
          message: "Invalid or inactive parent branch",
        });
      }

      branchId = parentBranch._id;
      subBranchId = admin._id;
    }

    // 2. Validate customer details
    if (!customerDetails?.name?.trim() || !customerDetails?.phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name and phone are required",
      });
    }

    if (!/^[0-9]{10}$/.test(customerDetails.phone.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit customer phone number",
      });
    }

    // 3. Validate cart items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required",
      });
    }

    let checkoutItems = items.map((item) => ({
      productId:
        item.productId ||
        (typeof item.product === "object" ? item.product?._id : item.product),

      variantId:
        item.variantId ||
        (typeof item.variant === "object" ? item.variant?._id : item.variant),

      quantity: Number(item.quantity),
    }));

    // 4. Aggregate duplicate products and variants
    const aggregatedItems = new Map();

    for (const item of checkoutItems) {
      if (
        !mongoose.Types.ObjectId.isValid(item.productId) ||
        !mongoose.Types.ObjectId.isValid(item.variantId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product, variant or quantity",
        });
      }

      const key = `${item.productId}_${item.variantId}`;

      if (aggregatedItems.has(key)) {
        aggregatedItems.get(key).quantity += item.quantity;
      } else {
        aggregatedItems.set(key, { ...item });
      }
    }

    checkoutItems = Array.from(aggregatedItems.values());

    // 5. Load products and calculate backend prices
    let totalAmount = 0;
    const paymentAttemptItems = [];

    for (const item of checkoutItems) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const variant = product.variants.id(item.variantId);

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: `Variant not found for ${product.name}`,
        });
      }

      const priceDetails = await calculateVariantPrice(variant);
      const unitPrice = Number(priceDetails?.finalPrice);

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for ${product.name}`,
        });
      }

      const finalUnitPrice = Number(unitPrice.toFixed(2));

      const itemTotalPrice = Number(
        (finalUnitPrice * item.quantity).toFixed(2),
      );

      totalAmount += itemTotalPrice;

      paymentAttemptItems.push({
        product: product._id,
        variantId: variant._id.toString(),
        quantity: item.quantity,

        productSnapshot: product.toObject({
          depopulate: true,
          versionKey: false,
        }),

        variantSnapshot: variant.toObject({
          depopulate: true,
          versionKey: false,
        }),

        pricingSnapshot: priceDetails,
        unitPrice: finalUnitPrice,
        totalPrice: itemTotalPrice,

        stockAllocations: [],
        stockReservationStatus: "NOT_RESERVED",
      });
    }

    totalAmount = Number(totalAmount.toFixed(2));

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    // 6. Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `pos_${Date.now()}`,
    });

    let createdAttempt;

    // 7. Reserve stock and create PaymentAttempt atomically
    await session.withTransaction(async () => {
      for (const item of paymentAttemptItems) {
        const productId = item.product;
        const variantId = new mongoose.Types.ObjectId(item.variantId);

        let remainingQuantity = item.quantity;
        const allocations = [];

        // A. Supplier stock first - FIFO
        const supplierItems = await SupplierPurchaseItem.find({
          product: productId,
          variantId,
          availableQuantity: { $gt: 0 },
        })
          .sort({ createdAt: 1, _id: 1 })
          .session(session);

        for (const source of supplierItems) {
          if (remainingQuantity <= 0) break;

          const available = Number(source.availableQuantity);
          const take = Math.min(available, remainingQuantity);

          const result = await SupplierPurchaseItem.updateOne(
            {
              _id: source._id,
              availableQuantity: { $gte: take },
            },
            {
              $inc: {
                availableQuantity: -take,
              },
            },
            { session },
          );

          if (result.modifiedCount !== 1) {
            throw new Error("Supplier stock changed. Please try again.");
          }

          allocations.push({
            sourceType: "SUPPLIER",
            sourceItemId: source._id,
            quantity: take,
          });

          remainingQuantity -= take;
        }

        // B. Maker stock next - FIFO
        if (remainingQuantity > 0) {
          const makerItems = await MakerProductionItem.find({
            product: productId,
            variantId,
            availableQuantity: { $gt: 0 },
          })
            .sort({ createdAt: 1, _id: 1 })
            .session(session);

          for (const source of makerItems) {
            if (remainingQuantity <= 0) break;

            const available = Number(source.availableQuantity);
            const take = Math.min(available, remainingQuantity);

            const result = await MakerProductionItem.updateOne(
              {
                _id: source._id,
                availableQuantity: { $gte: take },
              },
              {
                $inc: {
                  availableQuantity: -take,
                },
              },
              { session },
            );

            if (result.modifiedCount !== 1) {
              throw new Error("Maker stock changed. Please try again.");
            }

            allocations.push({
              sourceType: "MAKER",
              sourceItemId: source._id,
              quantity: take,
            });

            remainingQuantity -= take;
          }
        }

        // C. Check actual source stock
        if (remainingQuantity > 0) {
          throw new Error(
            `Insufficient source stock for ${item.variantSnapshot.sku}`,
          );
        }

        // D. Reduce aggregate Product variant stock
        const stockResult = await Product.updateOne(
          {
            _id: productId,
            variants: {
              $elemMatch: {
                _id: variantId,
                stock: { $gte: item.quantity },
              },
            },
          },
          {
            $inc: {
              "variants.$.stock": -item.quantity,
            },
          },
          { session },
        );

        if (stockResult.modifiedCount !== 1) {
          throw new Error(
            `Product stock mismatch for ${item.variantSnapshot.sku}`,
          );
        }

        // E. Save reservation details
        item.stockAllocations = allocations;
        item.stockReservationStatus = "RESERVED";
        item.stockReservedAt = new Date();
        item.stockReservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      }

      // F. Create POS PaymentAttempt
      const attemptData = {
        orderSource: role,
        branch: branchId,
        subBranch: subBranchId,
        createdBy: admin._id,

        customerDetails: {
          name: customerDetails.name.trim(),
          phone: customerDetails.phone.trim(),
          email: customerDetails.email?.trim() || "",
        },

        paymentMethod: "UPI",
        checkoutMode: "POS",

        amount: totalAmount,
        currency: "INR",
        razorpayOrderId: razorpayOrder.id,
        status: "CREATED",

        items: paymentAttemptItems,
      };

      const attempts = await PaymentAttempt.create([attemptData], { session });

      createdAttempt = attempts[0];
    });

    // 8. Return Razorpay details
    return res.status(201).json({
      success: true,
      message: "POS stock reserved and Razorpay order created",
      data: {
        paymentAttemptId: createdAttempt._id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("Create POS Razorpay Order Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to initiate POS payment",
    });
  } finally {
    await session.endSession();
  }
};

exports.verifyPosRazorpayPayment = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    const {
      paymentAttemptId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // 1. Validate logged-in user
    if (!userId || !["BRANCH", "SUB_BRANCH"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized POS payment verification",
      });
    }

    if (
      !paymentAttemptId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are required",
      });
    }

    // 2. Validate Admin
    const admin = await Admin.findById(userId);

    if (!admin || !admin.isActive || admin.role !== role) {
      return res.status(403).json({
        success: false,
        message: "Invalid or inactive branch account",
      });
    }

    // 3. Find PaymentAttempt and validate ownership
    const attemptQuery = {
      _id: paymentAttemptId,
      razorpayOrderId: razorpay_order_id,
      orderSource: role,
    };

    if (role === "BRANCH") {
      attemptQuery.branch = admin._id;
      attemptQuery.subBranch = null;
    } else {
      if (!admin.branchId) {
        return res.status(403).json({
          success: false,
          message: "Sub-Branch parent branch not found",
        });
      }

      attemptQuery.branch = admin.branchId;
      attemptQuery.subBranch = admin._id;
    }

    const attempt = await PaymentAttempt.findOne(attemptQuery);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "POS payment attempt not found",
      });
    }

    // 4. If order already created, return existing order
    if (attempt.status === "ORDER_CREATED" && attempt.order) {
      return res.status(200).json({
        success: true,
        message: "Order already created",
        data: {
          orderId: attempt.order,
          paymentAttemptId: attempt._id,
          status: "ORDER_CREATED",
        },
      });
    }

    if (!["CREATED", "PAID"].includes(attempt.status)) {
      return res.status(400).json({
        success: false,
        message: `Payment attempt status is ${attempt.status}`,
      });
    }

    // 5. Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const signatureBuffer = Buffer.from(generatedSignature, "hex");
    const receivedSignatureBuffer = Buffer.from(razorpay_signature, "hex");

    if (
      signatureBuffer.length !== receivedSignatureBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, receivedSignatureBuffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay payment signature",
      });
    }

    // 6. Fetch actual payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== attempt.razorpayOrderId ||
      payment.amount !== Math.round(attempt.amount * 100) ||
      payment.currency !== attempt.currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment details mismatch",
      });
    }

    if (payment.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: `Payment is not captured. Current status: ${payment.status}`,
      });
    }

    // 7. Prevent payment ID mismatch on retry
    if (
      attempt.razorpayPaymentId &&
      attempt.razorpayPaymentId !== razorpay_payment_id
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment ID does not match this payment attempt",
      });
    }

    attempt.status = "PAID";
    attempt.razorpayPaymentId = razorpay_payment_id;

    await attempt.save();

    // 8. Build order items from reserved PaymentAttempt
    const orderItems = attempt.items.map((item) => ({
      product: item.product,
      variant: item.variantId,
      quantity: item.quantity,

      productSnapshot: item.productSnapshot,
      variantSnapshot: item.variantSnapshot,
      pricingSnapshot: item.pricingSnapshot,

      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    // 9. Call existing createOrder controller
    // This reuses the existing invoice PDF and WhatsApp logic.
    let responseStatus = 200;
    let responseData = null;

    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },

      json(data) {
        responseData = data;
        return this;
      },
    };

    await exports.createOrder(
      {
        user: req.user,

        body: {
          orderSource: attempt.orderSource,

          branch: attempt.branch,
          subBranch: attempt.subBranch,
          createdBy: attempt.createdBy,

          customerDetails: attempt.customerDetails,

          paymentMethod: "UPI",

          razorpayOrderId: attempt.razorpayOrderId,
          razorpayPaymentId,
          paymentAttemptId: attempt._id,

          items: orderItems,
        },
      },
      mockRes,
    );

    // 10. Handle createOrder response
    if (!responseData?.success) {
      // Payment is already captured.
      // Keep attempt as PAID for safe recovery/retry.
      return res.status(500).json({
        success: false,
        paymentCaptured: true,
        message:
          responseData?.message ||
          "Payment successful, but order creation failed",
        paymentAttemptId: attempt._id,
        status: "PAID",
      });
    }

    // 11. Return successful order
    const createdOrder = responseData.data;

    return res.status(200).json({
      success: true,
      message: "POS payment verified and order created successfully",
      data: {
        paymentAttemptId: attempt._id,
        orderId: createdOrder?._id,
        order: createdOrder,
        status: "ORDER_CREATED",
      },
    });
  } catch (error) {
    console.error("Verify POS Razorpay Payment Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to verify POS payment",
    });
  }
};

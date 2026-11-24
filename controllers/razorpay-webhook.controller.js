const crypto = require("crypto");

const SchemePaymentAttempt = require("../models/scheme-payment-attempt");
const PaymentAttempt = require("../models/payment-attempt");

const { completeSchemeInstallment } = require("./schema-payment.controller");

const { createOrder } = require("./order.controller");

exports.razorpayWebhook = async (req, res) => {
  try {
    // ==========================================
    // 1. VERIFY WEBHOOK SIGNATURE
    // ==========================================

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!webhookSecret || !signature || !Buffer.isBuffer(req.body)) {
      return res.status(400).send("Invalid webhook request");
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    const receivedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return res.status(400).send("Invalid webhook signature");
    }

    // ==========================================
    // 2. PARSE EVENT
    // ==========================================

    const event = JSON.parse(req.body.toString("utf8"));

    console.log("RAZORPAY WEBHOOK EVENT:", event.event);

    if (!["payment.captured", "payment.failed"].includes(event.event)) {
      return res.status(200).json({ received: true });
    }

    const razorpayPayment = event.payload?.payment?.entity;

    if (!razorpayPayment?.order_id || !razorpayPayment?.id) {
      return res.status(400).send("Payment details missing");
    }

    // ==========================================
    // 3. PAYMENT FAILED
    // ==========================================

    if (event.event === "payment.failed") {
      console.log("RAZORPAY PAYMENT FAILED:", {
        orderId: razorpayPayment.order_id,
        paymentId: razorpayPayment.id,
      });

      return res.status(200).json({
        received: true,
        message: "Payment failure event received",
      });
    }

    // ==========================================
    // 4. VALIDATE CAPTURED PAYMENT
    // ==========================================

    if (
      razorpayPayment.status !== "captured" ||
      razorpayPayment.captured !== true
    ) {
      return res.status(400).send("Payment is not captured");
    }

    // ==========================================
    // 5. FIRST CHECK SCHEME PAYMENT
    // ==========================================

    const schemeAttempt = await SchemePaymentAttempt.findOne({
      razorpayOrderId: razorpayPayment.order_id,
    });

    if (schemeAttempt) {
      const expectedAmount = Math.round(Number(schemeAttempt.amount) * 100);

      if (
        razorpayPayment.amount !== expectedAmount ||
        razorpayPayment.currency !== schemeAttempt.currency
      ) {
        return res.status(400).send("Scheme payment mismatch");
      }

      const result = await completeSchemeInstallment({
        attemptId: schemeAttempt._id,
        userId: schemeAttempt.user,
        razorpayPaymentId: razorpayPayment.id,
      });

      console.log("SCHEME WEBHOOK SUCCESS:", {
        attemptId: schemeAttempt._id,
        paymentId: razorpayPayment.id,
        alreadyCompleted: result.alreadyCompleted,
      });

      return res.status(200).json({
        received: true,
        message: "Scheme installment processed",
      });
    }

    // ==========================================
    // 6. CHECK ECOMMERCE PAYMENT
    // ==========================================

    const onlineAttempt = await PaymentAttempt.findOne({
      razorpayOrderId: razorpayPayment.order_id,
      orderSource: "ONLINE",
    });

    if (!onlineAttempt) {
      console.log("NO MATCHING PAYMENT ATTEMPT:", razorpayPayment.order_id);

      return res.status(200).json({
        received: true,
        message: "No matching payment attempt found",
      });
    }

    // ==========================================
    // 7. VALIDATE ECOMMERCE PAYMENT
    // ==========================================

    const expectedOnlineAmount = Math.round(Number(onlineAttempt.amount) * 100);

    if (
      razorpayPayment.amount !== expectedOnlineAmount ||
      razorpayPayment.currency !== onlineAttempt.currency
    ) {
      return res.status(400).send("Ecommerce payment mismatch");
    }

    // Already completed
    if (onlineAttempt.status === "ORDER_CREATED") {
      return res.status(200).json({
        received: true,
        message: "Order already created",
      });
    }

    if (!["CREATED", "PAID"].includes(onlineAttempt.status)) {
      return res.status(200).json({
        received: true,
        message: "Payment attempt cannot be processed",
        status: onlineAttempt.status,
      });
    }

    // ==========================================
    // 8. UPDATE PAYMENT ATTEMPT AS PAID
    // ==========================================

    if (onlineAttempt.status === "CREATED") {
      await PaymentAttempt.findOneAndUpdate(
        {
          _id: onlineAttempt._id,
          status: "CREATED",
        },
        {
          $set: {
            status: "PAID",
            razorpayPaymentId: razorpayPayment.id,
          },
        },
        { new: true },
      );
    }

    const latestAttempt = await PaymentAttempt.findById(onlineAttempt._id);

    if (latestAttempt.status === "ORDER_CREATED") {
      return res.status(200).json({
        received: true,
        message: "Order already created",
      });
    }

    if (
      latestAttempt.status !== "PAID" ||
      (latestAttempt.razorpayPaymentId &&
        latestAttempt.razorpayPaymentId !== razorpayPayment.id)
    ) {
      throw new Error("Payment attempt update failed");
    }

    // ==========================================
    // 9. PREPARE ORDER ITEMS
    // ==========================================

    const orderItems = (latestAttempt.items || []).map((item) => ({
      product: item.product,
      variant: item.variantId,
      quantity: item.quantity,
    }));

    if (!orderItems.length) {
      throw new Error("Payment attempt has no order items");
    }

    // ==========================================
    // 10. CALL EXISTING CREATE ORDER
    // ==========================================

    let orderResponse;
    let responseStatus = 200;

    const internalReq = {
      user: {
        userId: latestAttempt.user.toString(),
      },
      body: {
        orderSource: "ONLINE",
        user: latestAttempt.user,
        address: latestAttempt.address,
        items: orderItems,
        paymentMethod: "ONLINE",
        razorpayOrderId: latestAttempt.razorpayOrderId,
        razorpayPaymentId: razorpayPayment.id,
        paymentAttemptId: latestAttempt._id,
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

    await createOrder(internalReq, internalRes);

    if (
      responseStatus >= 400 ||
      !orderResponse?.success ||
      !orderResponse?.data?._id
    ) {
      throw new Error(orderResponse?.message || "Order creation failed");
    }

    console.log("ECOMMERCE ORDER WEBHOOK SUCCESS:", {
      paymentAttemptId: latestAttempt._id,
      orderId: orderResponse.data._id,
      paymentId: razorpayPayment.id,
    });

    return res.status(200).json({
      received: true,
      message: "Ecommerce order created successfully",
      orderId: orderResponse.data._id,
    });
  } catch (error) {
    console.error("COMMON RAZORPAY WEBHOOK ERROR:", error);

    return res.status(500).json({
      received: false,
      message: "Webhook processing failed",
    });
  }
};

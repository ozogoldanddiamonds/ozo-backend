const axios = require("axios");

const sendOrderSuccessSms = async ({
  phone,
  customerName,
  orderNumber,
  orderDate,
  productDetails,
  totalAmount,
  paymentMode,
  paymentStatus,
  orderStatus,
  invoiceUrl,
}) => {
  try {
    // 1. Buddy configuration
    const baseUrl = process.env.BUDDY_SMS_BASE_URL?.trim();
    const apiKey = process.env.BUDDY_SMS_API_KEY?.trim();

    const templateId = Number(
      process.env.BUDDY_ORDER_SUCCESS_TEMPLATE_ID?.trim(),
    );

    if (
      !baseUrl ||
      !apiKey ||
      !Number.isInteger(templateId) ||
      templateId <= 0
    ) {
      throw new Error("Buddy Order SMS configuration missing or invalid");
    }

    // 2. Validate and normalize mobile number
    if (!phone) {
      throw new Error("Customer phone number missing");
    }

    let mobileNumber = String(phone).replace(/\D/g, "");

    if (mobileNumber.length === 12 && mobileNumber.startsWith("91")) {
      mobileNumber = mobileNumber.slice(2);
    }

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      throw new Error(`Invalid Indian mobile number: ${mobileNumber}`);
    }

    // 3. Validate order details
    if (!orderNumber) {
      throw new Error("Order number missing");
    }

    if (!invoiceUrl) {
      throw new Error("Invoice URL missing");
    }

    if (!customerName || !String(customerName).trim()) {
      throw new Error("Customer name missing for Order SMS");
    }

    const amount = Number(totalAmount);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Invalid order amount");
    }

    // 4. Prepare Buddy personalized SMS payload
    const payload = {
      template_id: templateId,
      unicode: 0,
      personalized: 1,

      numbers: [
        {
          number: mobileNumber,

          customerName: String(customerName).trim(),
          orderNumber: String(orderNumber).trim(),
          orderDate: String(orderDate || "N/A"),
          productDetails: String(productDetails || "Order Products"),
          totalAmount: String(amount),
          paymentMode: String(paymentMode || "N/A"),
          paymentStatus: String(paymentStatus || "PENDING"),
          orderStatus: String(orderStatus || "PLACED"),
          invoiceUrl: String(invoiceUrl).trim(),
        },
      ],
    };

    const endpoint = `${baseUrl.replace(/\/+$/, "")}/sms/sendMessage`;

    // 5. Log request details
    console.log("========== ORDER SUCCESS SMS STARTED ==========");

    console.log({
      templateId,
      mobileNumber: `******${mobileNumber.slice(-4)}`,
      customerName,
      orderNumber,
      totalAmount: amount,
      invoiceUrl,
    });

    // 6. Send SMS through Buddy
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });

    console.log("========== BUDDY ORDER SMS RESPONSE ==========");
    console.log(response.data);

    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message || "Buddy order SMS request failed",
      );
    }

    const result = {
      success: true,
      message: response.data.message,
      referenceId: response.data.reference_id,
      templateId,
      orderNumber,
      mobileNumber: `******${mobileNumber.slice(-4)}`,
    };

    console.log("========== ORDER SMS ACCEPTED ==========");
    console.log(result);

    return response.data;
  } catch (error) {
    console.error("========== ORDER SUCCESS SMS ERROR ==========");

    console.error({
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    throw error;
  }
};

module.exports = sendOrderSuccessSms;

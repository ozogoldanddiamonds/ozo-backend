const axios = require("axios");

const sendOrderSuccessSms = async ({
  phone,
  orderId,
  paymentId,
  amount,
  orderDetails,
}) => {
  try {
    const baseUrl = process.env.BUDDY_SMS_BASE_URL?.trim();
    const apiKey = process.env.BUDDY_SMS_API_KEY?.trim();

    const templateId = Number(
      process.env.BUDDY_ORDER_SUCCESS_TEMPLATE_ID?.trim(),
    );

    if (!baseUrl) {
      throw new Error("BUDDY_SMS_BASE_URL is missing");
    }

    if (!apiKey) {
      throw new Error("BUDDY_SMS_API_KEY is missing");
    }

    if (!Number.isSafeInteger(templateId) || templateId <= 0) {
      throw new Error("Invalid order success SMS template ID");
    }

    if (!phone) {
      throw new Error("Customer phone number is missing");
    }

    if (!orderId || !paymentId) {
      throw new Error("Order ID or Payment ID is missing");
    }

    if (!Number.isFinite(Number(amount))) {
      throw new Error("Invalid order amount");
    }

    // Buddy SMS Payload
    const payload = {
      template_id: templateId,
      unicode: 0,
      personalized: 1,
      numbers: [
        {
          number: phone,

          // IMPORTANT:
          // These keys must match Buddy template 24356
          // variable mapping exactly.

          "#alp1#": String(orderId),
          "#alp2#": String(paymentId),

          // DLT template expects: Rs. 25000
          // Do not send 25000.00
          "#num1#": String(Math.round(Number(amount))),

          // DLT template expects: Gold Ring - 1 Item
          "#alp3#": String(orderDetails || "Order placed successfully"),
        },
      ],
    };

    console.log("ORDER SMS FINAL PAYLOAD:", JSON.stringify(payload, null, 2));

    const response = await axios.post(`${baseUrl}/sms/sendMessage`, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    console.log(
      "ORDER SMS GATEWAY STATUS:",
      response.status,
      "BODY:",
      JSON.stringify(response.data, null, 2),
    );

    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message || "Order success SMS gateway rejected request",
      );
    }

    return response.data;
  } catch (error) {
    console.error("Order Success SMS Error:", {
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
    });

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        "Unable to send order success SMS",
    );
  }
};

module.exports = sendOrderSuccessSms;

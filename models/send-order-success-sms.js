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

    if (!baseUrl || !apiKey) {
      throw new Error("Buddy SMS configuration is missing");
    }

    if (!Number.isSafeInteger(templateId) || templateId <= 0) {
      throw new Error("Invalid Order Success SMS Template ID");
    }

    // 2. Validate phone
    if (!phone) {
      throw new Error("Customer phone number is missing");
    }

    let mobileNumber = String(phone).replace(/\D/g, "");

    if (mobileNumber.length === 12 && mobileNumber.startsWith("91")) {
      mobileNumber = mobileNumber.substring(2);
    }

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      throw new Error("Invalid Indian mobile number");
    }

    // 3. Validate required fields
    if (!customerName || !String(customerName).trim()) {
      throw new Error("Customer name is missing");
    }

    if (!orderNumber) {
      throw new Error("Order number is missing");
    }

    if (!invoiceUrl || !/^https:\/\//i.test(String(invoiceUrl))) {
      throw new Error("Valid HTTPS invoice URL is required");
    }

    const amount = Number(totalAmount);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Invalid order amount");
    }

    // 4. Buddy personalized template payload
    const payload = {
      template_id: templateId,
      unicode: 0,
      personalized: 1,

      numbers: [
        {
          number: mobileNumber,

          // Buddy variable 1
          customerName: String(customerName).trim(),

          // Buddy variable 2
          orderNumber: String(orderNumber).trim(),

          // Buddy variable 3
          orderDate: String(orderDate || "N/A"),

          // Buddy variable 4
          productDetails: String(productDetails || "Order Products"),

          // Buddy variable 5
          totalAmount: String(Math.round(amount)),

          // Buddy variable 6
          paymentMode: String(paymentMode || "N/A"),

          // Buddy variable 7
          paymentStatus: String(paymentStatus || "PENDING"),

          // Buddy variable 8
          orderStatus: String(orderStatus || "Confirmed"),

          // Buddy variable 9 - URL
          invoiceUrl: String(invoiceUrl).trim(),
        },
      ],
    };

    const endpoint = `${baseUrl.replace(/\/+$/, "")}/sms/sendMessage`;

    // 5. Log request
    console.log("========== ORDER SUCCESS SMS STARTED ==========");

    console.log({
      templateId,
      mobileNumber: `******${mobileNumber.slice(-4)}`,
      customerName,
      orderNumber,
      invoiceUrl,
    });

    console.log(
      "ORDER SMS PAYLOAD:",
      JSON.stringify(
        {
          ...payload,
          numbers: payload.numbers.map(({ number, ...variables }) => ({
            number: `******${number.slice(-4)}`,
            ...variables,
          })),
        },
        null,
        2,
      ),
    );

    // 6. Send SMS
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });

    console.log("BUDDY ORDER SMS RESPONSE:", response.data);

    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message || "Buddy rejected Order Success SMS",
      );
    }

    console.log("========== ORDER SUCCESS SMS ACCEPTED ==========");

    console.log({
      orderNumber,
      templateId,
      referenceId: response.data.reference_id,
      status: response.data.message,
    });

    return response.data;
  } catch (error) {
    console.error("========== ORDER SUCCESS SMS FAILED ==========");

    console.error({
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
    });

    throw error;
  }
};

module.exports = sendOrderSuccessSms;

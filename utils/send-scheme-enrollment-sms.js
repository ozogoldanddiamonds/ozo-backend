const axios = require("axios");

const sendSchemeEnrollmentSms = async ({
  phone,
  customerName,
  schemeName,
  totalAmount,
  monthlyAmount,
  durationMonths,
  userPayMonths,
  companyPayMonths,
}) => {
  try {
    const baseUrl = process.env.BUDDY_SMS_BASE_URL?.trim();
    const apiKey = process.env.BUDDY_SMS_API_KEY?.trim();

    const templateId = Number(
      process.env.BUDDY_SCHEME_ENROLLMENT_TEMPLATE_ID?.trim(),
    );

    if (!baseUrl) {
      throw new Error("BUDDY_SMS_BASE_URL is missing");
    }

    if (!apiKey) {
      throw new Error("BUDDY_SMS_API_KEY is missing");
    }

    if (!Number.isSafeInteger(templateId) || templateId <= 0) {
      throw new Error("Invalid scheme enrollment SMS template ID");
    }

    if (!phone) {
      throw new Error("Customer phone number is missing");
    }

    // Buddy SMS Payload
    const payload = {
      template_id: templateId,
      unicode: 0,
      personalized: 1,
      numbers: [
        {
          number: phone,

          // These placeholders must match your approved DLT template.
          "#num1#": String(customerName || "Customer"),
          "#num2#": String(schemeName),
          "#num3#": String(totalAmount),
          "#num4#": String(monthlyAmount),
          "#num5#": String(durationMonths),
          "#num6#": String(userPayMonths),
          "#num7#": String(companyPayMonths),
        },
      ],
    };

    const response = await axios.post(`${baseUrl}/sms/sendMessage`, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    console.log("Scheme Enrollment SMS Response:", response.data);

    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message ||
          "Scheme enrollment SMS gateway rejected request",
      );
    }

    return response.data;
  } catch (error) {
    console.error("Scheme Enrollment SMS Error:", {
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
    });

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        "Unable to send scheme enrollment SMS",
    );
  }
};

module.exports = sendSchemeEnrollmentSms;

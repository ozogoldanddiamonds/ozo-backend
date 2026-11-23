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
    // 1. Buddy configuration
    const baseUrl = process.env.BUDDY_SMS_BASE_URL?.trim();
    const apiKey = process.env.BUDDY_SMS_API_KEY?.trim();

    const templateId = Number(
      process.env.BUDDY_SCHEME_ENROLLMENT_TEMPLATE_ID?.trim(),
    );

    if (!baseUrl || !apiKey) {
      throw new Error("Buddy SMS configuration is missing");
    }

    if (!Number.isSafeInteger(templateId) || templateId <= 0) {
      throw new Error("Invalid scheme enrollment SMS template ID");
    }

    // 2. Validate phone number
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

    // 3. Validate customer and scheme details
    if (!customerName || !String(customerName).trim()) {
      throw new Error("Customer name is missing");
    }

    if (!schemeName) {
      throw new Error("Scheme name is missing");
    }

    // 4. Validate numeric values
    const validateNumber = (value, fieldName) => {
      const number = Number(value);

      if (!Number.isFinite(number) || number < 0) {
        throw new Error(`Invalid ${fieldName}`);
      }

      return String(number);
    };

    // 5. Buddy personalized SMS payload
    const payload = {
      template_id: templateId,
      unicode: 0,
      personalized: 1,

      numbers: [
        {
          number: mobileNumber,

          // DLT Variable 1: {#alp#}
          customerName: String(customerName).trim(),

          // DLT Variable 2: {#alp#}
          schemeName: String(schemeName).trim(),

          // DLT Variable 3: {#num#}
          totalAmount: validateNumber(totalAmount, "total amount"),

          // DLT Variable 4: {#num#}
          monthlyInstallment: validateNumber(
            monthlyAmount,
            "monthly installment",
          ),

          // DLT Variable 5: {#num#}
          duration: validateNumber(durationMonths, "scheme duration"),

          // DLT Variable 6: {#num#}
          paymentPeriod: validateNumber(userPayMonths, "payment period"),

          // DLT Variable 7: {#num#}
          companyContribution: validateNumber(
            companyPayMonths,
            "company contribution",
          ),
        },
      ],
    };

    const endpoint = `${baseUrl.replace(/\/+$/, "")}/sms/sendMessage`;
    // DEBUG: Verify Buddy template variables
    console.log("========== SCHEME SMS DEBUG ==========");
    console.log("Buddy Template ID:", templateId);

    console.log(
      "SCHEME SMS VARIABLES:",
      JSON.stringify(payload.numbers[0], null, 2),
    );
    // 6. Log request details
    console.log("========== SCHEME ENROLLMENT SMS ==========");

    console.log({
      templateId,
      mobileNumber: `******${mobileNumber.slice(-4)}`,
      customerName,
      schemeName,
    });

    // 7. Send SMS
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });

    console.log("BUDDY SCHEME ENROLLMENT SMS RESPONSE:", response.data);

    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message ||
          "Scheme enrollment SMS gateway rejected request",
      );
    }

    console.log("========== SCHEME ENROLLMENT SMS ACCEPTED ==========");

    console.log({
      templateId,
      customerName,
      schemeName,
      referenceId: response.data.reference_id,
      status: response.data.message,
    });

    return response.data;
  } catch (error) {
    console.error("SCHEME ENROLLMENT SMS ERROR:", {
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
    });

    throw error;
  }
};

module.exports = sendSchemeEnrollmentSms;

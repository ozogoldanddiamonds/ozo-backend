const axios = require("axios");

const sendSchemeInstallmentSms = async ({
  phone,
  schemeName,
  installmentNo,
  totalInstallments,
  amount,
  paymentDate,
  paymentMode,
  totalPaidAmount,
  totalPaidInstallments,
  remainingInstallments,
  nextInstallmentDueDate,
  nextInstallmentAmount,
  totalSchemeValue,
}) => {
  try {
    const baseUrl = process.env.BUDDY_SMS_BASE_URL?.trim();
    const apiKey = process.env.BUDDY_SMS_API_KEY?.trim();

    const templateId = Number(
      process.env.BUDDY_SCHEME_INSTALLMENT_TEMPLATE_ID?.trim(),
    );

    // Validate configuration
    if (!baseUrl || !apiKey || !templateId) {
      throw new Error("Buddy SMS configuration missing");
    }

    if (!phone) {
      throw new Error("Customer phone number missing");
    }

    // Convert Indian phone number to 10-digit format
    let mobileNumber = String(phone).replace(/\D/g, "");

    if (mobileNumber.length === 12 && mobileNumber.startsWith("91")) {
      mobileNumber = mobileNumber.substring(2);
    }

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      throw new Error("Invalid Indian mobile number");
    }

    // Validate numeric DLT variables
    const numericValue = (value) => {
      const number = Number(value);

      if (!Number.isFinite(number) || number < 0) {
        throw new Error("Invalid numeric SMS variable");
      }

      return String(Math.round(number));
    };

    // Buddy named-placeholder payload
    const payload = {
      template_id: templateId,
      unicode: 0,
      personalized: 1,

      numbers: [
        {
          number: mobileNumber,

          // {name}
          name: String(schemeName || "OZO Gold Savings Scheme"),

          // {fullAmount}
          fullAmount: numericValue(installmentNo),

          // {monthInstallment}
          monthInstallment: numericValue(totalInstallments),

          // {success}
          success: numericValue(amount),

          // {date}
          date: String(paymentDate),

          // {online}
          online: String(paymentMode || "ONLINE"),

          // {paidAmount}
          paidAmount: numericValue(totalPaidAmount),

          // {presentMonth}
          presentMonth: numericValue(totalPaidInstallments),

          // {pendingMonths}
          pendingMonths: numericValue(remainingInstallments),

          // {nextMonthDue}
          nextMonthDue: String(nextInstallmentDueDate || "N/A"),

          // {nextMonth}
          nextMonth: numericValue(nextInstallmentAmount),

          // {totalSchemeAmount}
          totalSchemeAmount: numericValue(totalSchemeValue),
        },
      ],
    };

    const endpoint = `${baseUrl.replace(/\/+$/, "")}/sms/sendMessage`;

    console.log("========== SCHEME INSTALLMENT SMS ==========");
    console.log("Buddy Template ID:", templateId);
    console.log("SMS endpoint:", endpoint);
    console.log("SMS variable keys:", Object.keys(payload.numbers[0]));

    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });

    console.log("BUDDY SMS RESPONSE:", response.data);

    if (response.data?.success !== true) {
      throw new Error(
        response.data?.message || "Buddy scheme installment SMS failed",
      );
    }

    return response.data;
  } catch (error) {
    console.error("SCHEME INSTALLMENT SMS ERROR:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    throw error;
  }
};

module.exports = sendSchemeInstallmentSms;

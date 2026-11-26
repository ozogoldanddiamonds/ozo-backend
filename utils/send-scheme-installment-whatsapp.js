const axios = require("axios");

const sendSchemeInstallmentWhatsApp = async ({
  phone,
  customerName,
  schemeName,
  installmentNo,
  totalInstallments,
  amount,
  paymentDate,
  transactionId,
  paymentStatus,
  totalPaidAmount,
  remainingInstallments,
  nextDueDate,
}) => {
  const baseUrl = process.env.BUDDY_BASE_URL?.trim();
  const apiToken = process.env.BUDDY_API_TOKEN?.trim();
  const phoneNumberId = process.env.BUDDY_PHONE_NUMBER_ID?.trim();
  const templateName = process.env.BUDDY_SCHEME_TEMPLATE_NAME?.trim();
  const language = process.env.BUDDY_TEMPLATE_LANGUAGE?.trim() || "en_US";

  if (!baseUrl || !apiToken || !phoneNumberId || !templateName) {
    throw new Error("Scheme WhatsApp configuration is missing");
  }

  let cleanedPhone = String(phone || "").replace(/\D/g, "");

  if (cleanedPhone.length === 10) {
    cleanedPhone = `91${cleanedPhone}`;
  } else if (!(cleanedPhone.length === 12 && cleanedPhone.startsWith("91"))) {
    throw new Error("Invalid Indian WhatsApp mobile number");
  }

  const parameters = [
    customerName || "Customer", // {{1}}
    schemeName || "-", // {{2}}
    String(installmentNo), // {{3}}
    String(totalInstallments), // {{4}}
    Number(amount || 0).toFixed(2), // {{5}}
    paymentDate || "-", // {{6}}
    transactionId || "-", // {{7}}
    paymentStatus || "Paid", // {{8}}
    Number(totalPaidAmount || 0).toFixed(2), // {{9}}
    String(remainingInstallments), // {{10}}
    nextDueDate || "N/A", // {{11}}
  ];

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: `+${cleanedPhone}`,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: "body",
          parameters: parameters.map((value) => ({
            type: "text",
            text: String(value),
          })),
        },
      ],
    },
  };

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/whatsapp/${phoneNumberId}/messages`;

  const response = await axios.post(endpoint, payload, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    timeout: 20000,
  });

  const messageId = response.data?.messages?.[0]?.id;

  if (!messageId) {
    throw new Error(
      response.data?.message || "WhatsApp gateway did not return a message ID",
    );
  }

  return {
    success: true,
    messageId,
    response: response.data,
  };
};

module.exports = sendSchemeInstallmentWhatsApp;

const axios = require("axios");

const sendOrderImageWhatsApp = async ({
  phone,
  productImage,
  orderNumber,
  customerName,
  productName,
  quantity,
  orderAmount,
}) => {
  try {
    const baseUrl = process.env.BUDDY_BASE_URL?.trim();
    const apiToken = process.env.BUDDY_API_TOKEN?.trim();
    const phoneNumberId = process.env.BUDDY_PHONE_NUMBER_ID?.trim();
    const templateName = process.env.BUDDY_ORDER_IMAGE_TEMPLATE_NAME?.trim();
    const language = process.env.BUDDY_TEMPLATE_LANGUAGE?.trim() || "en_US";

    if (!baseUrl || !apiToken || !phoneNumberId || !templateName) {
      throw new Error("Order Image WhatsApp configuration is missing");
    }

    // Phone validation
    let cleanedPhone = String(phone || "").replace(/\D/g, "");

    if (cleanedPhone.length === 10) {
      cleanedPhone = `91${cleanedPhone}`;
    } else if (cleanedPhone.length !== 12 || !cleanedPhone.startsWith("91")) {
      throw new Error("Invalid Indian WhatsApp mobile number");
    }

    // Image URL validation
    const imageUrl = String(productImage || "").trim();

    if (!/^https:\/\//i.test(imageUrl)) {
      throw new Error("Valid public HTTPS product image URL is required");
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanedPhone,
      type: "template",

      template: {
        name: templateName,
        language: {
          code: language,
        },

        components: [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: {
                  link: imageUrl,
                },
              },
            ],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: String(orderNumber) },
              { type: "text", text: String(customerName || "Customer") },
              { type: "text", text: String(productName || "Jewellery") },
              { type: "text", text: String(quantity || 1) },
              {
                type: "text",
                text: Number(orderAmount || 0).toFixed(2),
              },
            ],
          },
        ],
      },
    };

    const endpoint = `${baseUrl.replace(/\/+$/, "")}/whatsapp/${phoneNumberId}/messages`;

    console.log("ORDER IMAGE WHATSAPP REQUEST:", {
      endpoint,
      phone: cleanedPhone,
      templateName,
      productImage: imageUrl,
      bodyParameters: payload.template.components[1].parameters,
    });

    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    });

    const messageId = response.data?.messages?.[0]?.id;

    if (!messageId) {
      throw new Error("WhatsApp gateway did not return a message ID");
    }

    return {
      success: true,
      messageId,
      response: response.data,
    };
  } catch (error) {
    console.error("ORDER IMAGE WHATSAPP ERROR:", {
      message: error.message,
      response: error.response?.data,
    });

    throw new Error(
      error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message,
    );
  }
};

module.exports = sendOrderImageWhatsApp;

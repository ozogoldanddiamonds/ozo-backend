
const axios = require("axios");

const sendOrderWhatsApp = async ({
    phone,
    customerName,
    orderId,
    orderDate,
    orderAmount,
    paymentStatus,
    invoiceUrl
}) => {

    try {

        const baseUrl = process.env.BUDDY_BASE_URL?.trim();
        const apiToken = process.env.BUDDY_API_TOKEN?.trim();
        const phoneNumberId = process.env.BUDDY_PHONE_NUMBER_ID?.trim();
        const templateName = process.env.BUDDY_TEMPLATE_NAME?.trim();
        const language = process.env.BUDDY_TEMPLATE_LANGUAGE?.trim();

        // Validate environment variables
        if (!baseUrl) {
            throw new Error("BUDDY_BASE_URL is missing");
        }

        if (!apiToken) {
            throw new Error("BUDDY_API_TOKEN is missing");
        }

        if (!phoneNumberId) {
            throw new Error("BUDDY_PHONE_NUMBER_ID is missing");
        }

        if (!templateName || !language) {
            throw new Error("WhatsApp template configuration is missing");
        }

        // Validate customer phone
        let cleanedPhone = String(phone || "").replace(/\D/g, "");

        if (cleanedPhone.length === 10) {
            cleanedPhone = `91${cleanedPhone}`;
        } else if (
            cleanedPhone.length === 12 &&
            cleanedPhone.startsWith("91")
        ) {
            // Already includes India country code
        } else {
            throw new Error("Invalid Indian WhatsApp mobile number");
        }

        // Document header is mandatory for this approved template
        if (!invoiceUrl) {
            throw new Error(
                "Invoice document URL is required for this WhatsApp template"
            );
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: `+${cleanedPhone}`,
            type: "template",

            template: {
                name: templateName,

                language: {
                    code: language
                },

                components: [

                    // DOCUMENT HEADER
                    {
                        type: "header",
                        parameters: [
                            {
                                type: "document",
                                document: {
                                    link: invoiceUrl,
                                    filename: `OZO_Order_${orderId}.pdf`
                                }
                            }
                        ]
                    },

                    // BODY VARIABLES
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: String(customerName || "Customer")
                            },
                            {
                                type: "text",
                                text: String(orderId)
                            },
                            {
                                type: "text",
                                text: String(orderDate)
                            },
                            {
                                type: "text",
                                text: String(orderAmount)
                            },
                            {
                                type: "text",
                                text: String(paymentStatus)
                            }
                        ]
                    }

                ]
            }
        };

        const endpoint =
            `${baseUrl.replace(/\/+$/, "")}/whatsapp/${phoneNumberId}/messages`;

        const response = await axios.post(
            endpoint,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json"
                },
                timeout: 20000
            }
        );

        console.log("Buddy WhatsApp Response:", response.data);

        if (
            !response.data?.messages ||
            !response.data.messages.length
        ) {
            throw new Error(
                response.data?.message ||
                "WhatsApp gateway did not return a message ID"
            );
        }

        return {
            success: true,
            message: "Order confirmation WhatsApp sent successfully",
            messageId: response.data.messages[0].id,
            response: response.data
        };

    } catch (error) {

        console.error("Buddy WhatsApp Error:", {
            message: error.message,
            status: error.response?.status,
            response: error.response?.data
        });

        throw new Error(
            error.response?.data?.error?.message ||
            error.response?.data?.message ||
            error.message ||
            "Unable to send order confirmation WhatsApp"
        );

    }

};

module.exports = sendOrderWhatsApp;

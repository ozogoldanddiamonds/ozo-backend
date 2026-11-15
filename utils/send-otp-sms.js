
const axios = require("axios");

const sendOtpSms = async (phone, otp) => {
    try {
        const baseUrl = process.env.BUDDY_SMS_BASE_URL?.trim();
        const apiKey = process.env.BUDDY_SMS_API_KEY?.trim();
        const templateId = Number(
            process.env.BUDDY_SMS_TEMPLATE_ID?.trim()
        );

        if (!baseUrl) {
            throw new Error("BUDDY_SMS_BASE_URL is missing");
        }

        if (!apiKey) {
            throw new Error("BUDDY_SMS_API_KEY is missing");
        }

        if (!Number.isSafeInteger(templateId) || templateId <= 0) {
            throw new Error(
                "Invalid Buddy template_id. Use the numeric template_id from Buddy dashboard."
            );
        }

        // SMS Payload
        const payload = {
            template_id: templateId,
            unicode: 0,
            personalized: 1,
            numbers: [
                {
                    number: phone,
                    "#num1#": String(otp),
                    "#num2#": "5"
                }
            ]
        };

        // Debug Console
        console.log("\n========== BUDDY OTP SMS DEBUG ==========");
        console.log("Phone Number:", phone);
        console.log("Generated OTP:", String(otp));
        console.log("OTP Type:", typeof otp);
        console.log("Template ID:", templateId);
        console.log("OTP Variable (num):", payload.numbers[0].num);
        console.log("Minutes Variable (num2):", payload.numbers[0].num2);
        console.log("Complete SMS Payload:");
        console.log(JSON.stringify(payload, null, 2));
        console.log("==========================================\n");

        const response = await axios.post(
            `${baseUrl}/sms/sendMessage`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        console.log("Buddy SMS Response:", response.data);

        if (response.data?.success !== true) {
            throw new Error(
                response.data?.message || "SMS gateway rejected request"
            );
        }

        return response.data;

    } catch (error) {
        console.error("Buddy SMS Error:", {
            message: error.message,
            status: error.response?.status,
            response: error.response?.data
        });

        throw new Error(
            error.response?.data?.message ||
            error.message ||
            "Unable to send OTP SMS"
        );
    }
};

module.exports = sendOtpSms;


const axios = require("axios");

const BASE_URL = process.env.BUDDY_BASE_URL;
const API_TOKEN = process.env.BUDDY_API_TOKEN;

const buddyClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
    },
    timeout: 20000
});

const getAllTemplates = async () => {
    const wabaId = process.env.BUDDY_WABA_ID;

    if (!API_TOKEN || !wabaId || !BASE_URL) {
        throw new Error("Buddy WhatsApp environment variables are missing");
    }

    const response = await buddyClient.get(
        `/whatsapp/${wabaId}/message_templates`
    );

    return response.data;
};
const getTemplateById = async () => {
    const wabaId = process.env.BUDDY_WABA_ID;
    const templateId = process.env.BUDDY_TEMPLATE_ID;

    if (!wabaId || !templateId) {
        throw new Error("WABA ID or Template ID missing");
    }

    const response = await buddyClient.get(
        `/whatsapp/${wabaId}/message_templates/id/${templateId}`
    );

    return response.data;
};
module.exports = {
    getAllTemplates, getTemplateById
};

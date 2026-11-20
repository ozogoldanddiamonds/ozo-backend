
const { getAllTemplates } = require("../utils/buddyWhatsappService");

exports.fetchWhatsAppTemplates = async (req, res) => {
    try {
        const data = await getAllTemplates();

        return res.status(200).json({
            success: true,
            message: "WhatsApp templates fetched successfully",
            data
        });

    } catch (error) {
        console.error(
            "Buddy WhatsApp Error:",
            error.response?.data || error.message
        );

        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Unable to fetch WhatsApp templates",
            error: error.response?.data || error.message
        });
    }
};



const BASE_URL = process.env.SEQUEL247_BASE_URL;
const TOKEN = process.env.SEQUEL247_TOKEN;

const sequel247Request = async (endpoint, payload = {}) => {
    if (!BASE_URL || !TOKEN) {
        throw new Error("Sequel247 configuration missing");
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ...payload,
            token: TOKEN
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || `Sequel247 HTTP error: ${response.status}`
        );
    }

    return data;
};

// Verify OZO registered pickup address
const searchPickupAddress = async () => {
    return sequel247Request("/api/search_address", {
        keyword: process.env.SEQUEL247_PICKUP_STORE_CODE
    });
};

// Check customer delivery pincode
const checkServiceability = async (pincode) => {
    return sequel247Request("/api/checkServiceability", {
        pin_code: String(pincode)
    });
};

const createSequelShipment = async (payload) => {
    return sequel247Request("/api/shipment/create", payload);
};



const trackSequelShipment = async (docketNumber) => {
    if (!/^\d{10}$/.test(String(docketNumber))) {
        throw new Error("Docket number must be exactly 10 digits");
    }

    return await sequel247Request("/api/track", {
        docket: String(docketNumber)
    });
};


const trackMultipleSequelShipments = async (dockets) => {
    if (!Array.isArray(dockets) || dockets.length === 0) {
        throw new Error("At least one docket number is required");
    }

    const validDockets = [
        ...new Set(
            dockets.map(docket => String(docket).trim())
        )
    ];

    const invalidDockets = validDockets.filter(
        docket => !/^\d{10}$/.test(docket)
    );

    if (invalidDockets.length) {
        throw new Error(
            `Invalid docket numbers: ${invalidDockets.join(", ")}`
        );
    }

    return await sequel247Request("/api/trackMultiple", {
        dockets: validDockets
    });
};

const cancelSequelShipment = async (docket, cancelReason) => {
    if (!/^\d{10}$/.test(String(docket))) {
        throw new Error("Invalid Sequel247 docket number");
    }

    if (!cancelReason || !cancelReason.trim()) {
        throw new Error("Cancellation reason is required");
    }

    return sequel247Request("/api/cancel", {
        docket: String(docket),
        cancelReason: cancelReason.trim()
    });
};


// Download Proof of Delivery
// Download Proof of Delivery
const downloadSequelPOD = async ({
    requestType = "docket",
    dockets = [],
    fromDate,
    toDate
}) => {

    if (!["docket", "date"].includes(requestType)) {
        throw new Error("Invalid POD request type");
    }

    if (!fromDate || !toDate) {
        throw new Error("POD fromDate and toDate are required");
    }

    if (new Date(fromDate) > new Date(toDate)) {
        throw new Error("fromDate cannot be greater than toDate");
    }

    if (requestType === "docket") {

        if (!Array.isArray(dockets) || dockets.length === 0) {
            throw new Error("At least one docket number is required");
        }

        const invalidDockets = dockets.filter(
            docket => !/^\d{10}$/.test(String(docket).trim())
        );

        if (invalidDockets.length) {
            throw new Error(
                `Invalid docket numbers: ${invalidDockets.join(", ")}`
            );
        }
    }

    return sequel247Request("/api/podDownload", {
        requestType,
        dockets: requestType === "docket"
            ? [...new Set(dockets.map(d => String(d).trim()))]
            : [],
        fromDate,
        toDate
    });
};

module.exports = {
    searchPickupAddress,
    checkServiceability,
    createSequelShipment,
    trackSequelShipment,
    trackMultipleSequelShipments,
    cancelSequelShipment,
    downloadSequelPOD
};



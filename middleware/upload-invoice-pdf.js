
const cloudinary = require("../cloudinaryconfig");

const uploadInvoicePdf = async (pdfBuffer, invoiceNumber) => {

    if (!Buffer.isBuffer(pdfBuffer) || !pdfBuffer.length) {
        throw new Error("Valid invoice PDF buffer is required");
    }

    if (!invoiceNumber) {
        throw new Error("Invoice number is required");
    }

    return new Promise((resolve, reject) => {

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "ozo/invoices",
                public_id: `${invoiceNumber}.pdf`,
                resource_type: "raw",
                overwrite: true,
                unique_filename: false
            },
            (error, result) => {

                if (error) {
                    console.error("Cloudinary Invoice Upload Error:", error);
                    return reject(error);
                }

                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    bytes: result.bytes
                });
            }
        );

        uploadStream.end(pdfBuffer);
    });
};

module.exports = uploadInvoicePdf;

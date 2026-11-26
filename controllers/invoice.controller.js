const mongoose = require("mongoose");

const User = require("../models/user-login");
const Admin = require("../models/user");
const Order = require("../models/order");

const generateInvoicePdf = require("../utils/invoicePdfGenerator");
const uploadInvoicePdf = require("../middleware/upload-invoice-pdf");
const downloadOrderInvoice = async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    // 1. Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID or Order ID",
      });
    }

    // 2. Verify logged-in Admin
    const adminId = req.user?.id || req.user?.userId || req.user?._id;

    if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin authentication",
      });
    }

    const admin = await Admin.findById(adminId).lean();

    if (!admin || !admin.isActive || admin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Admin account is inactive or not found",
      });
    }

    // 3. Get ONLINE order belonging to customer
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      orderSource: "ONLINE",
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Online customer order not found",
      });
    }

    // 4. Validate items
    // 4. Validate order items
    if (!Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are missing or invalid",
        itemsType: typeof order.items,
      });
    }

    // 5. Get customer
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // 6. Generate invoice number
    if (!order.invoiceNumber) {
      order.invoiceNumber = `INV-${order.orderNumber}`;
    }

    if (!order.invoiceDate) {
      order.invoiceDate = new Date();
    }

    // 7. Generate PDF
    const pdfBuffer = await generateInvoicePdf(
      order,
      user,
      order.invoiceNumber,
    );

    if (!Buffer.isBuffer(pdfBuffer) || !pdfBuffer.length) {
      throw new Error("Invalid PDF buffer");
    }

    // 8. Upload to Cloudinary
    const uploadResult = await uploadInvoicePdf(pdfBuffer, order.invoiceNumber);

    // 9. Update order
    order.invoicePdfUrl = uploadResult.url;
    order.invoiceGeneratedAt = new Date();

    await order.save();

    // 10. Download PDF
    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${order.invoiceNumber}.pdf"`,
    );

    res.setHeader("Content-Length", pdfBuffer.length);

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("Invoice Download Error:", error);
    console.error("========== INVOICE GENERATION ERROR ==========");
    console.error(error.stack || error);
    console.error("===============================================");

    return res.status(500).json({
      success: false,
      message: "Invoice generation failed",
      error: error.message,
    });
  }
};

module.exports = {
  downloadOrderInvoice,
};

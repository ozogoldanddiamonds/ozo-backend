
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD
  },

  // Avoid waiting for a long time when SMTP is unreachable.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,

  // Prefer IPv4 if the hosting environment has IPv6 routing issues.
  family: 4
});

const escapeHtml = (value) => {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
};

// OTP email
const sendEmail = async (email, subject, otp) => {
  return transporter.sendMail({
    from: `"OZO Gold & Diamonds" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    text: `Your OTP is ${otp}`
  });
};

// Invoice email
// Usage: sendInvoiceEmail(customerEmail, order)
const sendInvoiceEmail = async (email, order) => {
  if (!email || !order) {
    throw new Error("Customer email and order are required");
  }

  const customer = order.customerDetails || {};
  const address = order.addressSnapshot || {};

  const items = Array.isArray(order.items) ? order.items : [];

  const itemRows = items.map((item, index) => {
    const productName =
      item.productSnapshot?.name || "Jewellery Product";

    const sku =
      item.variantSnapshot?.sku || "-";

    const quantity =
      Number(item.quantity) || 0;

    const unitPrice =
      Number(item.unitPrice) || 0;

    const totalPrice =
      Number(item.totalPrice) || unitPrice * quantity;

    return `
            <tr>
                <td style="padding:10px;border:1px solid #ddd;">
                    ${index + 1}
                </td>
                <td style="padding:10px;border:1px solid #ddd;">
                    ${escapeHtml(productName)}
                    <br>
                    <small>SKU: ${escapeHtml(sku)}</small>
                </td>
                <td style="padding:10px;border:1px solid #ddd;text-align:center;">
                    ${quantity}
                </td>
                <td style="padding:10px;border:1px solid #ddd;text-align:right;">
                    ₹${unitPrice.toFixed(2)}
                </td>
                <td style="padding:10px;border:1px solid #ddd;text-align:right;">
                    ₹${totalPrice.toFixed(2)}
                </td>
            </tr>
        `;
  }).join("");

  const formatMoney = (amount) =>
    `₹${(Number(amount) || 0).toFixed(2)}`;

  const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OZO Invoice</title>
        </head>
        <body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,sans-serif;color:#333;">
            <div style="max-width:750px;margin:auto;background:#fff;padding:24px;border:1px solid #eee;">

                <h1 style="margin:0;color:#9a7410;">
                    OZO Gold &amp; Diamonds
                </h1>

                <p style="margin-top:8px;">
                    Thank you for your order!
                </p>

                <hr style="border:none;border-top:1px solid #ddd;">

                <h2>Invoice</h2>

                <p>
                    <strong>Invoice No:</strong>
                    ${escapeHtml(order.invoiceNumber || "-")}
                    <br>

                    <strong>Order No:</strong>
                    ${escapeHtml(order.orderNumber || "-")}
                    <br>

                    <strong>Invoice Date:</strong>
                    ${escapeHtml(
    order.invoiceDate
      ? new Date(order.invoiceDate).toLocaleDateString("en-IN")
      : new Date().toLocaleDateString("en-IN")
  )}
                    <br>

                    <strong>Payment Method:</strong>
                    ${escapeHtml(order.paymentMethod || "-")}
                    <br>

                    <strong>Payment Status:</strong>
                    ${escapeHtml(order.paymentStatus || "-")}
                </p>

                <h3>Customer Details</h3>

                <p>
                    <strong>Name:</strong>
                    ${escapeHtml(customer.name || address.fullName || "-")}
                    <br>

                    <strong>Email:</strong>
                    ${escapeHtml(email)}
                    <br>

                    <strong>Phone:</strong>
                    ${escapeHtml(customer.phone || address.phone || "-")}
                </p>

                <h3>Delivery Address</h3>

                <p>
                    ${escapeHtml(address.addressLine1 || "")}
                    ${address.addressLine2
      ? `, ${escapeHtml(address.addressLine2)}`
      : ""}
                    <br>

                    ${escapeHtml(address.landmark || "")}
                    ${address.landmark ? "<br>" : ""}

                    ${escapeHtml(address.city || "")}
                    ${address.city ? ", " : ""}
                    ${escapeHtml(address.state || "")}
                    <br>

                    ${escapeHtml(address.postalCode || "")}
                    ${address.country
      ? `, ${escapeHtml(address.country)}`
      : ""}
                </p>

                <h3>Order Items</h3>

                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead>
                        <tr style="background:#f8f3e5;">
                            <th style="padding:10px;border:1px solid #ddd;">#</th>
                            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Product</th>
                            <th style="padding:10px;border:1px solid #ddd;">Qty</th>
                            <th style="padding:10px;border:1px solid #ddd;text-align:right;">Price</th>
                            <th style="padding:10px;border:1px solid #ddd;text-align:right;">Total</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${itemRows}
                    </tbody>
                </table>

                <table style="width:100%;margin-top:20px;border-collapse:collapse;">
                    <tr>
                        <td style="padding:6px;text-align:right;">Subtotal</td>
                        <td style="padding:6px;text-align:right;width:150px;">
                            ${formatMoney(order.subTotal)}
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:6px;text-align:right;">Discount</td>
                        <td style="padding:6px;text-align:right;">
                            - ${formatMoney(order.discountAmount)}
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:6px;text-align:right;">Shipping</td>
                        <td style="padding:6px;text-align:right;">
                            ${formatMoney(order.shippingCharge)}
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:6px;text-align:right;">GST</td>
                        <td style="padding:6px;text-align:right;">
                            ${formatMoney(order.gstAmount)}
                        </td>
                    </tr>

                    <tr style="font-size:18px;font-weight:bold;background:#f8f3e5;">
                        <td style="padding:12px;text-align:right;">Grand Total</td>
                        <td style="padding:12px;text-align:right;">
                            ${formatMoney(order.totalAmount)}
                        </td>
                    </tr>
                </table>

                <p style="margin-top:25px;">
                    Thank you for shopping with OZO Gold &amp; Diamonds.
                </p>

                <p style="font-size:12px;color:#777;">
                    This is a computer-generated invoice email.
                </p>
            </div>
        </body>
        </html>
    `;

  return transporter.sendMail({
    from: `"OZO Gold & Diamonds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Invoice ${order.invoiceNumber || order.orderNumber || ""} - OZO Gold & Diamonds`,
    html
  });
};

module.exports = {
  transporter,
  sendEmail,
  sendInvoiceEmail
};



// const nodemailer =
// require("nodemailer");

// const transporter =
// nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user:
//       "maddisettivennela@gmail.com",
//     pass:
//       "szde intn vafg idog"
//   }
// });

// const sendEmail =
// async (
//   email,
//   subject,
//   otp
// ) => {
//   const mailOptions = {
//     from:
//       "maddisettivennela@gmail.com",
//     to: email,
//     subject,
//     text:
//       `Your OTP is ${otp}`
//   };

//   return await transporter.sendMail(
//     mailOptions
//   );
// };
// const sendInvoiceEmail = async (
//     email,
//     subject,
//     html
// ) => {

//     const mailOptions = {

//         from: "maddisettivennela@gmail.com",

//         to: email,

//         subject,

//         html

//     };

//     return await transporter.sendMail(mailOptions);

// };

// module.exports = {
//   transporter,
//   sendEmail,
//   sendInvoiceEmail
// };
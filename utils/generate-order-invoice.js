const fs = require("fs/promises");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const LETTERHEAD_PATH = path.join(
  __dirname,
  "../templates/OZO_Letter_Head.pdf",
);

const formatAmount = (value) => {
  return `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (date) => {
  return new Date(date || Date.now()).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const safeText = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

const wrapText = (text, font, fontSize, maxWidth) => {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const generateOrderInvoice = async (order) => {
  if (!order) {
    throw new Error("Order details are required");
  }

  if (!order.items || !order.items.length) {
    throw new Error("Order must contain at least one item");
  }

  const letterheadBytes = await fs.readFile(LETTERHEAD_PATH);

  const pdfDoc = await PDFDocument.create();

  const embeddedPages = await pdfDoc.embedPdf(letterheadBytes);
  const background = embeddedPages[0];

  const pageWidth = background.width;
  const pageHeight = background.height;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0.12, 0.12, 0.12);
  const grey = rgb(0.38, 0.38, 0.38);
  const lineColor = rgb(0.78, 0.78, 0.78);
  const gold = rgb(0.55, 0.34, 0.12);

  const margin = 38;
  const contentWidth = pageWidth - margin * 2;

  const bottomLimit = 112;
  let page;
  let y;

  const addPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);

    page.drawPage(background, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    y = pageHeight - 150;
  };

  const draw = (
    text,
    x,
    yPosition,
    size = 9,
    selectedFont = font,
    color = black,
  ) => {
    page.drawText(safeText(text), {
      x,
      y: yPosition,
      size,
      font: selectedFont,
      color,
    });
  };

  const drawRight = (
    text,
    rightX,
    yPosition,
    size = 9,
    selectedFont = font,
    color = black,
  ) => {
    const value = safeText(text);
    const width = selectedFont.widthOfTextAtSize(value, size);

    draw(value, rightX - width, yPosition, size, selectedFont, color);
  };

  const drawLine = (yPosition) => {
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: pageWidth - margin, y: yPosition },
      thickness: 0.6,
      color: lineColor,
    });
  };

  const drawSectionTitle = (title) => {
    draw(title, margin, y, 10, boldFont, gold);
    y -= 17;
  };

  const customer = order.customerDetails || {};
  const address = order.addressSnapshot || {};

  const paymentHistory = order.paymentHistory || [];

  const drawTableHeader = () => {
    const headerY = y;

    page.drawRectangle({
      x: margin,
      y: headerY - 7,
      width: contentWidth,
      height: 22,
      color: rgb(0.94, 0.91, 0.85),
    });

    draw("Product Details", margin + 6, headerY, 8, boldFont);
    draw("Qty", 350, headerY, 8, boldFont);
    drawRight("Unit Price", 455, headerY, 8, boldFont);
    drawRight("Total", pageWidth - margin - 5, headerY, 8, boldFont);

    y -= 30;
  };

  addPage();

  // =========================================
  // INVOICE TITLE
  // =========================================

  drawRight("TAX INVOICE", pageWidth - margin, y, 17, boldFont, gold);

  y -= 26;

  draw(`Invoice No: ${safeText(order.invoiceNumber)}`, margin, y, 9, boldFont);

  drawRight(
    `Invoice Date: ${formatDate(order.invoiceDate || order.createdAt)}`,
    pageWidth - margin,
    y,
    9,
    font,
  );

  y -= 15;

  draw(`Order No: ${safeText(order.orderNumber)}`, margin, y, 9);

  drawRight(
    `Order Date: ${formatDate(order.createdAt)}`,
    pageWidth - margin,
    y,
    9,
  );

  y -= 25;

  drawLine(y);
  y -= 20;

  // =========================================
  // CUSTOMER DETAILS
  // =========================================

  drawSectionTitle("BILL TO / CUSTOMER DETAILS");

  draw(`Name: ${safeText(customer.name)}`, margin, y, 9, boldFont);

  y -= 15;

  draw(`Mobile: ${safeText(customer.phone)}`, margin, y);

  y -= 15;

  draw(`Email: ${safeText(customer.email)}`, margin, y);

  y -= 22;

  drawSectionTitle("DELIVERY ADDRESS");

  const addressText = [
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");

  const addressLines = wrapText(
    addressText || "Address not available",
    font,
    8,
    contentWidth,
  );

  for (const line of addressLines) {
    draw(line, margin, y, 8);
    y -= 12;
  }

  y -= 12;

  drawLine(y);
  y -= 22;

  // =========================================
  // PRODUCT TABLE
  // =========================================

  drawSectionTitle("PRODUCT DETAILS");

  drawTableHeader();

  for (const item of order.items) {
    const product = item.productSnapshot || {};
    const variant = item.variantSnapshot || {};
    const pricing = item.pricingSnapshot || {};

    const productName = safeText(product.name, "Jewellery Product");

    const details = [
      `SKU: ${safeText(variant.sku)}`,
      `Metal: ${safeText(variant.metalType)}`,
      `Purity: ${safeText(variant.purity)}`,
      `Gross Weight: ${safeText(variant.grossWeight, "0")} g`,
      `Net Weight: ${safeText(variant.netWeight, "0")} g`,
      `Stone Weight: ${safeText(variant.stoneWeight, "0")} g`,
      `Diamond Weight: ${safeText(variant.diamondWeight, "0")} ct`,
    ].join(" | ");

    const detailLines = wrapText(details, font, 7, 285);

    const rowHeight = Math.max(44, 25 + Math.min(detailLines.length, 3) * 10);

    if (y - rowHeight < bottomLimit) {
      addPage();
      drawSectionTitle("PRODUCT DETAILS (CONTINUED)");
      drawTableHeader();
    }

    draw(productName, margin + 6, y, 8, boldFont);

    detailLines.slice(0, 3).forEach((line, index) => {
      draw(line, margin + 6, y - 12 - index * 10, 6.5, font, grey);
    });

    draw(String(item.quantity), 350, y, 8);

    drawRight(formatAmount(item.unitPrice), 455, y, 8);

    drawRight(
      formatAmount(item.totalPrice),
      pageWidth - margin - 5,
      y,
      8,
      boldFont,
    );

    y -= rowHeight;

    drawLine(y + 7);
    y -= 8;
  }

  // =========================================
  // ORDER PRICE BREAKDOWN
  // =========================================

  if (y < bottomLimit + 145) {
    addPage();
  }

  y -= 5;

  drawSectionTitle("PRICE BREAKDOWN");

  const summaryRows = [
    ["Subtotal", formatAmount(order.subTotal)],
    ["Discount", `- ${formatAmount(order.discountAmount)}`],
    ["GST", formatAmount(order.gstAmount)],
    ["Shipping Charges", formatAmount(order.shippingCharge)],
  ];

  for (const [label, value] of summaryRows) {
    draw(label, margin + 180, y, 8);

    drawRight(value, pageWidth - margin - 5, y, 8);

    y -= 16;
  }

  drawLine(y + 7);
  y -= 12;

  draw("GRAND TOTAL", margin + 180, y, 11, boldFont, gold);

  drawRight(
    formatAmount(order.totalAmount),
    pageWidth - margin - 5,
    y,
    11,
    boldFont,
    gold,
  );

  y -= 28;

  // =========================================
  // PAYMENT DETAILS
  // =========================================

  if (y < bottomLimit + 65) {
    addPage();
  }

  drawSectionTitle("PAYMENT DETAILS");

  draw(`Payment Method: ${safeText(order.paymentMethod)}`, margin, y, 8);

  y -= 15;

  draw(
    `Payment Status: ${safeText(order.paymentStatus)}`,
    margin,
    y,
    8,
    boldFont,
  );

  y -= 15;

  draw(`Order Status: ${safeText(order.orderStatus)}`, margin, y, 8);

  y -= 15;

  for (const payment of paymentHistory) {
    const paymentText = [
      `Transaction ID: ${safeText(payment.transactionId)}`,
      `Amount: ${formatAmount(payment.amount)}`,
      `Gateway: ${safeText(payment.paymentGateway)}`,
    ].join(" | ");

    const paymentLines = wrapText(paymentText, font, 7, contentWidth);

    for (const line of paymentLines) {
      if (y < bottomLimit + 15) {
        addPage();
      }

      draw(line, margin, y, 7, font, grey);
      y -= 11;
    }
  }

  y -= 15;

  if (y > bottomLimit) {
    drawLine(y);
    y -= 20;

    draw(
      "Thank you for shopping with OZO Gold and Diamond Jewellery Mart.",
      margin,
      y,
      8,
      boldFont,
      gold,
    );

    y -= 15;

    draw("This is a computer-generated invoice.", margin, y, 7, font, grey);
  }

  pdfDoc.setTitle(`Invoice ${order.invoiceNumber}`);
  pdfDoc.setSubject(`OZO Order ${order.orderNumber}`);
  pdfDoc.setCreator("OZO Gold and Diamond Jewellery Mart");

  const pdfBytes = await pdfDoc.save();

  return Buffer.from(pdfBytes);
};

module.exports = generateOrderInvoice;

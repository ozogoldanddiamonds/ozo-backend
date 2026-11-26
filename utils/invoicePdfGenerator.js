const PDFKitDocument = require("pdfkit");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const generateInvoicePdf = (order, user = {}, invoiceNumber) => {
  return new Promise((resolve, reject) => {
    let doc;

    try {
      if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        throw new Error("Order items are required to generate invoice");
      }

      const letterheadPath = path.resolve(
        __dirname,
        "../templates/OZO_Letter_Head.pdf",
      );

      if (!fs.existsSync(letterheadPath)) {
        throw new Error(`OZO letterhead PDF not found at: ${letterheadPath}`);
      }

      const PAGE_WIDTH = 595.28;
      const PAGE_HEIGHT = 841.89;
      const LEFT = 42;
      const RIGHT = 553;
      const CONTENT_WIDTH = RIGHT - LEFT;

      // The supplied OZO letterhead has a fixed header and footer.
      // Keep all invoice content inside the blank central area.
      const CONTENT_TOP = 174;
      const CONTENT_BOTTOM = 738;

      const RED = "#A51E22";
      const BLACK = "#252525";
      const GREY = "#666666";
      const LIGHT_GREY = "#E5E5E5";
      const PALE_RED = "#F7EEEE";

      const chunks = [];
      let y = CONTENT_TOP;

      const customer = order.customerDetails || {};
      const address = order.addressSnapshot || {};

      const customerName =
        customer.name || address.fullName || user.name || "Customer";
      const customerPhone =
        customer.phone || address.phone || user.phone || "-";
      const customerEmail = customer.email || user.email || "-";
      const finalInvoiceNumber = invoiceNumber || order.invoiceNumber || "-";

      const safe = (value, fallback = "-") => {
        if (value === undefined || value === null || value === "") {
          return fallback;
        }

        if (typeof value === "object") {
          if (value.name) return String(value.name);
          if (value.title) return String(value.title);
          if (value._id) return String(value._id);
          return fallback;
        }

        return String(value);
      };

      const toTitleCase = (value) => {
        const text = safe(value, "");
        if (!text) return "-";

        return text
          .replace(/[_-]+/g, " ")
          .toLowerCase()
          .replace(/\b[a-z]/g, (match) => match.toUpperCase());
      };

      const money = (value) => {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return "Rs. 0.00";

        return `Rs. ${amount.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      };

      const numeric = (value, decimals = 3) => {
        if (value === undefined || value === null || value === "") return "-";
        const n = Number(value);
        return Number.isFinite(n) ? n.toFixed(decimals) : safe(value);
      };

      const date = (value) => {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      };

      const dateTime = (value) => {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString("en-IN");
      };

      const addressParts = [
        address.addressLine1,
        address.addressLine2,
        address.landmark,
        address.city,
        address.state,
        address.postalCode,
        address.country,
      ].filter(Boolean);

      const fullAddress =
        addressParts.length > 0
          ? addressParts.join(", ")
          : [
              user.addressLine1,
              user.addressLine2,
              user.city,
              user.state,
              user.pincode,
              user.country,
            ]
              .filter(Boolean)
              .join(", ") || "-";

      const addPageHeader = () => {
        // The OZO letterhead already prints the company header/footer.
        // Only invoice metadata is printed in the central blank area.
        doc
          .font("Helvetica-Bold")
          .fontSize(15)
          .fillColor(RED)
          .text("TAX INVOICE", LEFT, CONTENT_TOP, {
            width: 190,
            lineBreak: false,
          });

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(BLACK)
          .text(
            `Invoice No: ${safe(finalInvoiceNumber)}`,
            365,
            CONTENT_TOP + 1,
            {
              width: 188,
              align: "right",
            },
          )
          .text(
            `Invoice Date: ${date(order.invoiceDate || order.createdAt)}`,
            365,
            CONTENT_TOP + 14,
            { width: 188, align: "right" },
          )
          .text(`Order No: ${safe(order.orderNumber)}`, 365, CONTENT_TOP + 27, {
            width: 188,
            align: "right",
          });

        y = CONTENT_TOP + 43;
      };

      const addNewPage = () => {
        doc.addPage({
          size: [PAGE_WIDTH, PAGE_HEIGHT],
          margin: 0,
        });
        addPageHeader();
      };

      const ensureSpace = (height = 20) => {
        if (y + height > CONTENT_BOTTOM) {
          addNewPage();
        }
      };

      const addSection = (title) => {
        ensureSpace(30);
        y += 5;

        doc.roundedRect(LEFT, y, CONTENT_WIDTH, 19, 2).fill(PALE_RED);

        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(RED)
          .text(String(title).toUpperCase(), LEFT + 7, y + 5, {
            width: CONTENT_WIDTH - 14,
          });

        y += 26;
      };

      const addText = (value, options = {}) => {
        const text = safe(value, "");
        if (!text) return;

        const x = options.x ?? LEFT;
        const width = options.width ?? CONTENT_WIDTH;
        const fontSize = options.fontSize ?? 8;
        const font = options.bold ? "Helvetica-Bold" : "Helvetica";
        const lineGap = options.lineGap ?? 2;

        doc.font(font).fontSize(fontSize);
        const height = doc.heightOfString(text, {
          width,
          lineGap,
        });

        ensureSpace(height + (options.gap ?? 4));

        doc
          .font(font)
          .fontSize(fontSize)
          .fillColor(options.color || BLACK)
          .text(text, x, y, {
            width,
            lineGap,
            align: options.align || "left",
          });

        y += height + (options.gap ?? 4);
      };

      const addKeyValue = (label, value, options = {}) => {
        const labelWidth = options.labelWidth ?? 190;
        const fontSize = options.fontSize ?? 8;
        const horizontalPadding = 6;
        const verticalPadding = 4;
        const valueText = safe(value);

        doc
          .font(options.bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(fontSize);

        const valueHeight = doc.heightOfString(valueText, {
          width: CONTENT_WIDTH - labelWidth - horizontalPadding * 2,
          lineGap: 1,
        });

        const labelHeight = doc.heightOfString(String(label), {
          width: labelWidth - horizontalPadding * 2,
          lineGap: 1,
        });

        const rowHeight =
          Math.max(17, valueHeight, labelHeight) + verticalPadding * 2;

        ensureSpace(rowHeight);

        // Label cell
        doc
          .rect(LEFT, y, labelWidth, rowHeight)
          .fill(options.labelBackground || "#F4F4F4");

        // Value cell
        doc
          .rect(LEFT + labelWidth, y, CONTENT_WIDTH - labelWidth, rowHeight)
          .fill(options.valueBackground || "#FFFFFF");

        // Outer border and column divider
        doc
          .rect(LEFT, y, CONTENT_WIDTH, rowHeight)
          .lineWidth(0.45)
          .strokeColor("#D8D8D8")
          .stroke();

        doc
          .moveTo(LEFT + labelWidth, y)
          .lineTo(LEFT + labelWidth, y + rowHeight)
          .lineWidth(0.45)
          .strokeColor("#D8D8D8")
          .stroke();

        doc
          .font(options.bold ? "Helvetica-Bold" : "Helvetica-Bold")
          .fontSize(fontSize)
          .fillColor(options.labelColor || BLACK)
          .text(String(label), LEFT + horizontalPadding, y + verticalPadding, {
            width: labelWidth - horizontalPadding * 2,
            lineGap: 1,
          });

        doc
          .font(options.bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(fontSize)
          .fillColor(options.color || BLACK)
          .text(
            valueText,
            LEFT + labelWidth + horizontalPadding,
            y + verticalPadding,
            {
              width: CONTENT_WIDTH - labelWidth - horizontalPadding * 2,
              lineGap: 1,
              align: options.valueAlign || "left",
            },
          );

        y += rowHeight;
      };

      // Two detail pairs per row (four visual columns) for readable spacing.
      const addDetailGridRow = (pairs) => {
        const groupWidth = CONTENT_WIDTH / 2;
        const labelWidth = 105;
        const valueWidth = groupWidth - labelWidth;
        const fontSize = 8;
        const padX = 6;
        const padY = 5;

        const prepared = [0, 1].map((index) => {
          const pair = pairs[index] || ["", ""];
          const label = pair[0] ? toTitleCase(pair[0]) : "";
          const value =
            pair[1] === undefined || pair[1] === null || pair[1] === ""
              ? "-"
              : safe(pair[1]);

          doc.font("Helvetica-Bold").fontSize(fontSize);
          const labelHeight = label
            ? doc.heightOfString(label, {
                width: labelWidth - padX * 2,
                lineGap: 1,
              })
            : 0;

          doc.font("Helvetica").fontSize(fontSize);
          const valueHeight = value
            ? doc.heightOfString(value, {
                width: valueWidth - padX * 2,
                lineGap: 1,
              })
            : 0;

          return {
            label,
            value,
            height: Math.max(labelHeight, valueHeight, 11),
          };
        });

        const rowHeight =
          Math.max(...prepared.map((item) => item.height)) + padY * 2;
        ensureSpace(rowHeight);

        prepared.forEach((item, index) => {
          const x = LEFT + index * groupWidth;

          doc.rect(x, y, labelWidth, rowHeight).fill("#F1F1F1");
          doc.rect(x + labelWidth, y, valueWidth, rowHeight).fill("#FFFFFF");

          doc
            .rect(x, y, groupWidth, rowHeight)
            .lineWidth(0.45)
            .strokeColor("#D8D8D8")
            .stroke();

          doc
            .moveTo(x + labelWidth, y)
            .lineTo(x + labelWidth, y + rowHeight)
            .lineWidth(0.45)
            .strokeColor("#D8D8D8")
            .stroke();

          if (item.label) {
            doc
              .font("Helvetica-Bold")
              .fontSize(fontSize)
              .fillColor(BLACK)
              .text(item.label, x + padX, y + padY, {
                width: labelWidth - padX * 2,
                lineGap: 1,
              });
          }

          if (item.value && item.value !== "-") {
            const displayValue =
              item.label === "SKU" ? item.value : toTitleCase(item.value);

            doc
              .font("Helvetica")
              .fontSize(fontSize)
              .fillColor(BLACK)
              .text(displayValue, x + labelWidth + padX, y + padY, {
                width: valueWidth - padX * 2,
                lineGap: 1,
              });
          }
        });

        y += rowHeight;
      };

      const addSubheading = (text) => {
        addText(text, {
          bold: true,
          color: RED,
          fontSize: 8.2,
          gap: 5,
        });
      };

      const drawCustomerDetails = () => {
        addSection("Customer Details");

        addKeyValue("Customer Name", toTitleCase(customerName));
        addKeyValue("Mobile Number", customerPhone);

        // Email is optional. Do not print an empty/dash row when unavailable.
        if (customerEmail && customerEmail !== "-") {
          addKeyValue("Email Address", customerEmail);
        }

        addKeyValue("Delivery Address", toTitleCase(fullAddress), {
          labelWidth: 125,
        });

        if (address.alternatePhone) {
          addKeyValue("Alternate Phone", address.alternatePhone);
        }
      };

      const drawStoneDetails = (stones) => {
        addSubheading("STONE DETAILS");

        if (!Array.isArray(stones) || stones.length === 0) {
          addText("No individual stone details available.", {
            color: GREY,
            fontSize: 8,
          });
          return;
        }

        stones.forEach((stone, index) => {
          ensureSpace(65);

          addText(`Stone ${index + 1}`, {
            bold: true,
            fontSize: 8,
            gap: 3,
          });

          const rows = [
            ["Stone Type", toTitleCase(stone.stoneType)],
            ["Stone Category", toTitleCase(stone.stoneCategory)],
            ["Quality", toTitleCase(stone.quality)],
            ["Quantity", stone.quantity],
            [
              "Total Weight",
              stone.totalWeight != null ? `${numeric(stone.totalWeight)}` : "-",
            ],
          ];

          rows.forEach(([label, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              addKeyValue(
                `  ${label}`,
                label === "Quantity" || label === "Total Weight"
                  ? value
                  : toTitleCase(value),
                {
                  labelWidth: 190,
                  fontSize: 8,
                  rowGap: 2,
                },
              );
            }
          });

          y += 3;
        });
      };

      const drawItemPricing = (pricing) => {
        addSubheading("ITEM PRICE BREAKUP");

        const rows = [
          [
            "Gold Rate",
            pricing.goldRate != null ? money(pricing.goldRate) : null,
          ],
          ["Gold Value", pricing.goldValue],
          ["Wastage Amount", pricing.wastageAmount],
          ["Stone Value", pricing.stoneValue],
          ["Diamond Value", pricing.diamondValue],
          ["Making Charge", pricing.makingCharge],
          ["Discount Amount", pricing.discountAmount],
          [
            "GST Percentage",
            pricing.gstPercentage != null
              ? `${numeric(pricing.gstPercentage, 2)}%`
              : null,
          ],
          ["GST Amount", pricing.gstAmount],
          ["Final Item Price", pricing.finalPrice],
        ];

        rows.forEach(([label, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            addKeyValue(
              label,
              label === "GST Percentage" ? value : money(value),
              {
                bold: label === "Final Item Price",
                color: label === "Final Item Price" ? RED : BLACK,
              },
            );
          }
        });
      };

      const drawProductDetails = (item, index) => {
        const product = item.productSnapshot || {};
        const variant = item.variantSnapshot || {};
        const pricing = item.pricingSnapshot || {};
        const stones = Array.isArray(variant.stones) ? variant.stones : [];

        addSection(`Product ${index + 1}: ${safe(product.name, "Product")}`);

        addText(toTitleCase(product.name || "Product"), {
          bold: true,
          fontSize: 9,
        });

        addDetailGridRow([
          ["SKU", safe(variant.sku)],
          ["Quantity", safe(item.quantity, "1")],
        ]);

        addDetailGridRow([
          ["Product Type", toTitleCase(product.productType)],
          ["Variant Size", toTitleCase(variant.size)],
        ]);

        addSubheading("VARIANT / METAL DETAILS");

        const variantRows = [
          ["Metal Type", toTitleCase(variant.metalType)],
          ["Purity", toTitleCase(variant.purity)],
          ["Metal Color", toTitleCase(variant.metalColor)],
          ["Size", variant.size],
          ["Gender", variant.gender],
          [
            "Gross Weight",
            variant.grossWeight != null
              ? `${numeric(variant.grossWeight)} g`
              : null,
          ],
          [
            "Net Weight",
            variant.netWeight != null
              ? `${numeric(variant.netWeight)} g`
              : null,
          ],
          [
            "Wastage Percentage",
            variant.wastagePercentage != null
              ? `${numeric(variant.wastagePercentage, 2)}%`
              : null,
          ],
          [
            "Stone Weight",
            variant.stoneWeight != null
              ? `${numeric(variant.stoneWeight)} g`
              : null,
          ],
          [
            "Diamond Weight",
            variant.diamondWeight != null
              ? `${numeric(variant.diamondWeight)} ct`
              : null,
          ],
          ["Making Charge Type", toTitleCase(variant.makingChargeType)],
          [
            "Making Charge",
            variant.makingCharge != null ? money(variant.makingCharge) : null,
          ],
          [
            "Discount Percentage",
            variant.discountPercentage != null
              ? `${numeric(variant.discountPercentage, 2)}%`
              : null,
          ],
          ["Stone Type", toTitleCase(variant.stoneType)],
        ];

        const availableVariantRows = variantRows.filter(
          ([, value]) => value !== undefined && value !== null && value !== "",
        );

        for (let i = 0; i < availableVariantRows.length; i += 2) {
          addDetailGridRow(
            availableVariantRows
              .slice(i, i + 2)
              .map(([label, value]) => [
                label,
                typeof value === "string" ? toTitleCase(value) : value,
              ]),
          );
        }

        drawStoneDetails(stones);

        // Stone value is stored in the item's pricingSnapshot, not in each
        // variant stone record in the supplied schema.
        const individualStoneValues = stones
          .map((stone) => Number(stone.stoneValue))
          .filter((value) => Number.isFinite(value));

        const totalStoneValue =
          pricing.stoneValue !== undefined && pricing.stoneValue !== null
            ? Number(pricing.stoneValue)
            : individualStoneValues.length > 0
              ? individualStoneValues.reduce((sum, value) => sum + value, 0)
              : null;

        if (totalStoneValue !== null) {
          addKeyValue("Total Stone Value", money(totalStoneValue));
        }

        drawItemPricing(pricing);

        ensureSpace(55);
        y += 4;

        doc
          .moveTo(LEFT, y)
          .lineTo(RIGHT, y)
          .strokeColor(LIGHT_GREY)
          .lineWidth(0.7)
          .stroke();

        y += 8;

        addKeyValue("Unit Price", money(item.unitPrice), { bold: true });
        addKeyValue("Quantity", safe(item.quantity, "1"));
        addKeyValue("Product Total", money(item.totalPrice), {
          bold: true,
          color: RED,
          fontSize: 9,
          rowGap: 5,
        });
      };

      //   const drawOrderSummary = () => {
      //     addSection("Order Summary");
      //     addKeyValue("Subtotal", money(order.subTotal));
      //     addKeyValue("Discount", money(order.discountAmount));
      //     if (order.couponCode) {
      //       addKeyValue("Coupon Code", safe(order.couponCode));
      //     }

      //     addKeyValue("Shipping Charge", money(order.shippingCharge));
      //     addKeyValue("GST Amount", money(order.gstAmount));

      //     y += 5;
      //     ensureSpace(30);

      //     doc
      //       .moveTo(LEFT, y)
      //       .lineTo(RIGHT, y)
      //       .strokeColor(RED)
      //       .lineWidth(1)
      //       .stroke();

      //     y += 10;

      //     addKeyValue("GRAND TOTAL", money(order.totalAmount), {
      //       bold: true,
      //       color: RED,
      //       fontSize: 11,
      //       labelWidth: 250,
      //       rowGap: 5,
      //     });
      //   };

      const drawPaymentDetails = () => {
        addSection("Payment Details");

        addKeyValue("Payment Method", safe(order.paymentMethod));
        addKeyValue("Payment Status", safe(order.paymentStatus));
        addKeyValue("Order Status", safe(order.orderStatus));

        const payments = Array.isArray(order.paymentHistory)
          ? order.paymentHistory
          : [];

        if (payments.length > 0) {
          y += 5;
          addSubheading("PAYMENT TRANSACTIONS");

          payments.forEach((payment, index) => {
            ensureSpace(75);

            addText(`Transaction ${index + 1}`, {
              bold: true,
              fontSize: 8,
              gap: 3,
            });

            addKeyValue("Payment Method", safe(payment.method), {
              fontSize: 8,
              rowGap: 2,
            });
            addKeyValue("Amount", money(payment.amount), {
              fontSize: 8,
              rowGap: 2,
            });
            addKeyValue("Transaction ID", safe(payment.transactionId), {
              fontSize: 8,
              rowGap: 2,
            });
            addKeyValue("Payment Gateway", safe(payment.paymentGateway), {
              fontSize: 8,
              rowGap: 2,
            });
            addKeyValue("Paid At", dateTime(payment.paidAt), {
              fontSize: 8,
              rowGap: 2,
            });

            y += 4;
          });
        } else {
          addText("No payment transaction details available.", {
            color: GREY,
            fontSize: 8,
          });
        }
      };

      // Create the content-only PDF. The OZO letterhead is merged behind it
      // after PDFKit finishes writing all pages.
      doc = new PDFKitDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margin: 0,
        bufferPages: true,
        autoFirstPage: true,
        compress: true,
      });

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("error", reject);

      doc.on("end", async () => {
        try {
          const invoiceContentBuffer = Buffer.concat(chunks);
          const letterheadBuffer = fs.readFileSync(letterheadPath);

          const letterheadPdf = await PDFDocument.load(letterheadBuffer);
          const contentPdf = await PDFDocument.load(invoiceContentBuffer);
          const finalPdf = await PDFDocument.create();

          const letterheadPages = letterheadPdf.getPages();
          if (!letterheadPages.length) {
            throw new Error("OZO letterhead PDF has no pages");
          }

          const letterheadPage = letterheadPages[0];
          const { width, height } = letterheadPage.getSize();

          const [letterheadBackground] = await finalPdf.embedPdf(
            letterheadPdf,
            [0],
          );

          const contentPageCount = contentPdf.getPageCount();

          for (let pageIndex = 0; pageIndex < contentPageCount; pageIndex++) {
            const contentPage = contentPdf.getPages()[pageIndex];
            const [embeddedContentPage] = await finalPdf.embedPdf(contentPdf, [
              pageIndex,
            ]);

            const page = finalPdf.addPage([width, height]);

            // Background first: original OZO header, watermark and footer.
            page.drawPage(letterheadBackground, {
              x: 0,
              y: 0,
              width,
              height,
            });

            // Invoice text on top, scaled to the letterhead page size.
            page.drawPage(embeddedContentPage, {
              x: 0,
              y: 0,
              width,
              height,
            });
          }

          const finalBytes = await finalPdf.save();
          resolve(Buffer.from(finalBytes));
        } catch (error) {
          reject(error);
        }
      });

      addPageHeader();
      drawCustomerDetails();

      order.items.forEach((item, index) => {
        drawProductDetails(item, index);
      });

      //   drawOrderSummary();
      drawPaymentDetails();

      // Customer closing message at the end of the invoice content.
      const closingMessage =
        "Thank you for placing your trust in OZO Gold and Diamond Jewellery Mart™. We are honoured to accompany you on this beautiful journey.";
      const tagline = "Every Shine Has a Story";

      doc.font("Helvetica").fontSize(8.5);
      const closingHeight = doc.heightOfString(closingMessage, {
        width: CONTENT_WIDTH - 30,
        align: "center",
        lineGap: 3,
      });

      ensureSpace(closingHeight + 42);

      y += 12;
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(BLACK)
        .text(closingMessage, LEFT + 15, y, {
          width: CONTENT_WIDTH - 30,
          align: "center",
          lineGap: 3,
        });

      y += closingHeight + 8;

      doc
        .font("Helvetica-BoldOblique")
        .fontSize(10)
        .fillColor(RED)
        .text(tagline, LEFT, y, {
          width: CONTENT_WIDTH,
          align: "center",
        });

      // Do not draw another footer. The supplied letterhead already has one.
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateInvoicePdf;

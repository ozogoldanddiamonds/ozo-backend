const nodemailer =
require("nodemailer");

const transporter =
nodemailer.createTransport({
  service: "gmail",
  auth: {
    user:
      "maddisettivennela@gmail.com",
    pass:
      "szde intn vafg idog"
  }
});

const sendEmail =
async (
  email,
  subject,
  otp
) => {
  const mailOptions = {
    from:
      "maddisettivennela@gmail.com",
    to: email,
    subject,
    text:
      `Your OTP is ${otp}`
  };

  return await transporter.sendMail(
    mailOptions
  );
};
const sendInvoiceEmail = async (
    email,
    subject,
    html
) => {

    const mailOptions = {

        from: "maddisettivennela@gmail.com",

        to: email,

        subject,

        html

    };

    return await transporter.sendMail(mailOptions);

};

module.exports = {
  transporter,
  sendEmail,
  sendInvoiceEmail
};
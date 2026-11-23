const { parsePhoneNumberFromString } = require("libphonenumber-js");

const normalizeSmsPhone = (input) => {
  const rawPhone = String(input || "").trim();

  if (!rawPhone) {
    throw new Error("Customer phone number is missing");
  }

  const phoneNumber = rawPhone.startsWith("+")
    ? parsePhoneNumberFromString(rawPhone)
    : parsePhoneNumberFromString(rawPhone, "IN");

  if (!phoneNumber || !phoneNumber.isValid()) {
    throw new Error("Invalid customer phone number");
  }

  return phoneNumber.number;
};

module.exports = normalizeSmsPhone;

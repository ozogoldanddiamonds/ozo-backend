const { parsePhoneNumberFromString } = require("libphonenumber-js");
const User = require("../models/user-login"); // Adjust path if required

// Normalize phone number to E.164
const normalizeInternationalPhone = (input) => {
  const rawPhone = String(input || "").trim();

  if (!rawPhone) {
    throw new Error("Please enter a mobile number");
  }

  let phoneNumber;

  if (rawPhone.startsWith("+")) {
    phoneNumber = parsePhoneNumberFromString(rawPhone);
  } else if (/^[6-9]\d{9}$/.test(rawPhone)) {
    // Backward compatibility for Indian numbers
    phoneNumber = parsePhoneNumberFromString(rawPhone, "IN");
  } else {
    throw new Error("Please enter a valid international mobile number");
  }

  if (!phoneNumber || !phoneNumber.isValid()) {
    throw new Error("Please enter a valid international mobile number");
  }

  return {
    phone: phoneNumber.number,
    countryCode: `+${phoneNumber.countryCallingCode}`,
    country: phoneNumber.country || null,
    nationalNumber: phoneNumber.nationalNumber,
  };
};

// Find existing user and support old Indian records
const findUserByInternationalPhone = async (phoneData) => {
  const { phone, nationalNumber, country } = phoneData;

  const candidates = [phone];

  if (country === "IN") {
    candidates.push(nationalNumber);
  }

  let user = await User.findOne({
    phone: { $in: candidates },
  });

  if (user && user.phone !== phone) {
    const existingUser = await User.findOne({
      phone,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      throw new Error(
        "This mobile number is already associated with another account",
      );
    }

    user.phone = phone;
    user.phoneCountryCode = phoneData.countryCode;

    await user.save();
  }

  return user;
};

module.exports = {
  normalizeInternationalPhone,
  findUserByInternationalPhone,
};

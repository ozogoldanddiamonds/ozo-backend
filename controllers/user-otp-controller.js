const User = require("../models/user-login");
const UserSession = require("../models/user-session");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  normalizeInternationalPhone,
  findUserByInternationalPhone,
} = require("../utils/phoneUtils");
const sendOtpSms = require("../utils/send-otp-sms");
const sendOrderWhatsApp = require("../utils/send-order-whatsapp");

const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;
const ACCESS_TOKEN_EXPIRY = "15m";
const ACCESS_TOKEN_SECONDS = 900;

// Web refresh cookie configuration
const REFRESH_COOKIE_NAME = "ozoRefreshToken";

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  path: "/",
});

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
};

// PHONE
const normalizePhone = (phone) => {
  let cleaned = String(phone || "").replace(/\D/g, "");

  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.substring(2);
  }

  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    throw new Error("Please enter a valid 10-digit Indian mobile number");
  }

  return cleaned;
};

// OTP HASH
const hashOtp = (otp) => {
  if (!process.env.OTP_SECRET) {
    throw new Error("OTP_SECRET is missing");
  }

  return crypto
    .createHmac("sha256", process.env.OTP_SECRET)
    .update(String(otp))
    .digest("hex");
};

const compareOtp = (storedHash, enteredOtp) => {
  try {
    const stored = Buffer.from(storedHash, "hex");
    const entered = Buffer.from(hashOtp(enteredOtp), "hex");

    return (
      stored.length === entered.length &&
      crypto.timingSafeEqual(stored, entered)
    );
  } catch {
    return false;
  }
};

// ACCESS TOKEN
const generateAccessToken = (userId, sessionId) => {
  return jwt.sign(
    {
      userId: userId.toString(),
      sessionId: sessionId.toString(),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    },
  );
};

// REFRESH TOKEN
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

const hashRefreshToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// SAFE USER
const safeUser = (user) => {
  const data = user.toObject();

  delete data.password;
  delete data.token;
  delete data.OTP;
  delete data.OTPExpires;
  delete data.refreshTokenHash;
  delete data.refreshTokenExpiresAt;
  delete data.__v;

  return data;
};

// DEVICE DETAILS
const getDeviceDetails = (req) => {
  const deviceId =
    String(req.body.deviceId || req.headers["x-device-id"] || "").trim() ||
    crypto.randomUUID();

  const deviceName = String(
    req.body.deviceName || req.headers["x-device-name"] || "Unknown Device",
  )
    .trim()
    .substring(0, 100);

  const requestedPlatform = String(
    req.body.platform || req.headers["x-client-platform"] || "unknown",
  ).toLowerCase();

  const allowedPlatforms = ["web", "android", "ios"];

  const platform = allowedPlatforms.includes(requestedPlatform)
    ? requestedPlatform
    : "unknown";

  return { deviceId, deviceName, platform };
};

// CREATE SESSION
const createUserSession = async (user, req) => {
  const { deviceId, deviceName, platform } = getDeviceDetails(req);

  const refreshToken = generateRefreshToken();

  const session = await UserSession.create({
    userId: user._id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    deviceId,
    deviceName,
    platform,
    lastUsedAt: new Date(),
    revokedAt: null,
  });

  const accessToken = generateAccessToken(user._id, session._id);

  return {
    accessToken,
    refreshToken,
    sessionId: session._id,
    deviceId,
    deviceName,
    platform,
  };
};

// SEND OTP

exports.sendUserOtp = async (req, res) => {
  let user;
  let isNewDocument = false;
  let previousOtp;
  let previousExpiry;
  let previousName;

  try {
    if (!process.env.OTP_SECRET || !process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication environment variables are missing",
      });
    }

    // 1. Normalize phone
    const phoneData = normalizeInternationalPhone(req.body.phone);
    const { phone, countryCode } = phoneData;

    // 2. Find existing user
    user = await findUserByInternationalPhone(phoneData);

    // 3. Get name
    const name = String(req.body.name || "").trim();

    // 4. Validate name only when required
    if (!user || !user.name || !user.name.trim()) {
      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid customer name",
        });
      }
    }

    // 5. Resend restriction
    if (user && user.OTPExpires && user.OTP) {
      const previousExpiryTime = new Date(user.OTPExpires).getTime();

      const previousSentTime =
        previousExpiryTime - OTP_EXPIRY_MINUTES * 60 * 1000;

      const elapsedSeconds = (Date.now() - previousSentTime) / 1000;

      if (elapsedSeconds >= 0 && elapsedSeconds < OTP_RESEND_SECONDS) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(
            OTP_RESEND_SECONDS - elapsedSeconds,
          )} seconds before requesting another OTP`,
        });
      }
    }

    // 6. Create new user if not found
    if (!user) {
      user = new User({
        name,
        phone,
        phoneCountryCode: countryCode,
        isVerified: false,
      });

      isNewDocument = true;
    } else {
      // Preserve existing customer name
      if (!user.name || !user.name.trim()) {
        previousName = user.name;
        user.name = name;
      }
    }

    // 7. Store previous OTP
    previousOtp = user.OTP;
    previousExpiry = user.OTPExpires;

    // 8. Generate OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    user.phone = phone;
    user.phoneCountryCode = countryCode;
    user.OTP = hashOtp(otp);
    user.OTPExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await user.save();

    try {
      // 9. Send SMS
      const smsResult = await sendOtpSms(phone, otp);

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        data: {
          phone,
          countryCode,
          expiresIn: OTP_EXPIRY_MINUTES * 60,
          smsReferenceId: smsResult.referenceId,
          result: smsResult,
        },
      });
    } catch (smsError) {
      // 10. Rollback
      if (isNewDocument) {
        await User.deleteOne({ _id: user._id });
      } else {
        user.OTP = previousOtp;
        user.OTPExpires = previousExpiry;

        if (previousName !== undefined) {
          user.name = previousName;
        }

        await user.save();
      }

      throw smsError;
    }
  } catch (error) {
    console.error("Send OTP Error:", error);

    const statusCode =
      error.message.includes("valid") ||
      error.message.includes("Please enter") ||
      error.message.includes("already associated")
        ? 400
        : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to send OTP",
    });
  }
};

// CHECK CUSTOMER MOBILE
exports.checkCustomerMobile = async (req, res) => {
  try {
    const phoneData = normalizeInternationalPhone(req.body.phone);

    const user = await findUserByInternationalPhone(phoneData);

    const nameRequired = !user || !user.name || !user.name.trim();

    return res.status(200).json({
      success: true,
      userExists: !!user,
      nameRequired,
      message: nameRequired ? "Customer name is required" : "Customer found",
    });
  } catch (error) {
    console.error("Check Customer Mobile Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to check mobile number",
    });
  }
};
exports.verifyUserOtp = async (req, res) => {
  try {
    // 1. Normalize international phone
    const phoneData = normalizeInternationalPhone(req.body.phone);

    const { phone } = phoneData;

    const otp = String(req.body.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit OTP",
      });
    }

    if (!process.env.OTP_SECRET || !process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication environment variables are missing",
      });
    }

    // 2. Find user
    const user = await findUserByInternationalPhone(phoneData);

    if (!user || !user.OTP || !user.OTPExpires) {
      return res.status(400).json({
        success: false,
        message: "OTP not found. Please request a new OTP",
      });
    }

    // 3. Check OTP expiry
    if (new Date(user.OTPExpires).getTime() < Date.now()) {
      user.OTP = undefined;
      user.OTPExpires = undefined;

      await user.save();

      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new OTP",
      });
    }

    // 4. Compare OTP
    if (!compareOtp(user.OTP, otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // 5. Verify user
    const isNewUser = !user.isVerified;

    user.isVerified = true;
    user.OTP = undefined;
    user.OTPExpires = undefined;

    await user.save();

    // 6. Create independent device session
    const sessionData = await createUserSession(user, req);

    const isWeb = sessionData.platform === "web";

    if (isWeb) {
      setRefreshCookie(res, sessionData.refreshToken);
    }

    // 7. Return response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      isNewUser,

      accessToken: sessionData.accessToken,

      // Web refresh token remains HttpOnly cookie
      ...(isWeb
        ? {}
        : {
            refreshToken: sessionData.refreshToken,
          }),

      sessionId: sessionData.sessionId,
      deviceId: sessionData.deviceId,
      expiresIn: ACCESS_TOKEN_SECONDS,

      user: safeUser(user),
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);

    const statusCode =
      error.message.includes("valid") ||
      error.message.includes("Please enter") ||
      error.message.includes("already associated")
        ? 400
        : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "OTP verification failed",
    });
  }
};

// exports.sendUserOtp = async (req, res) => {
//   let user;
//   let isNewDocument = false;
//   let previousOtp;
//   let previousExpiry;

//   try {
//     const phone = normalizePhone(req.body.phone);

//     if (!process.env.OTP_SECRET || !process.env.JWT_SECRET) {
//       return res.status(500).json({
//         success: false,
//         message: "Authentication environment variables are missing",
//       });
//     }

//     user = await User.findOne({ phone });

//     if (user && user.OTPExpires && user.OTP) {
//       const previousExpiryTime = new Date(user.OTPExpires).getTime();

//       const previousSentTime =
//         previousExpiryTime - OTP_EXPIRY_MINUTES * 60 * 1000;

//       const elapsedSeconds = (Date.now() - previousSentTime) / 1000;

//       if (elapsedSeconds >= 0 && elapsedSeconds < OTP_RESEND_SECONDS) {
//         return res.status(429).json({
//           success: false,
//           message: `Please wait ${Math.ceil(
//             OTP_RESEND_SECONDS - elapsedSeconds,
//           )} seconds before requesting another OTP`,
//         });
//       }
//     }

//     if (!user) {
//       user = new User({
//         phone,
//         isVerified: false,
//       });

//       isNewDocument = true;
//     }

//     previousOtp = user.OTP;
//     previousExpiry = user.OTPExpires;

//     const otp = crypto.randomInt(100000, 1000000).toString();

//     user.OTP = hashOtp(otp);
//     user.OTPExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

//     await user.save();

//     try {
//       const smsResult = await sendOtpSms(phone, otp);

//       return res.status(200).json({
//         success: true,
//         message: "OTP sent successfully",
//         data: {
//           phone,
//           expiresIn: OTP_EXPIRY_MINUTES * 60,
//           smsReferenceId: smsResult.referenceId,
//           result: smsResult,
//         },
//       });
//     } catch (smsError) {
//       if (isNewDocument) {
//         await User.deleteOne({ _id: user._id });
//       } else {
//         user.OTP = previousOtp;
//         user.OTPExpires = previousExpiry;
//         await user.save();
//       }

//       throw smsError;
//     }
//   } catch (error) {
//     console.error("Send OTP Error:", error.message);

//     return res
//       .status(error.message.includes("valid 10-digit") ? 400 : 500)
//       .json({
//         success: false,
//         message: error.message || "Unable to send OTP",
//       });
//   }
// };

// VERIFY OTP AND LOGIN
// exports.verifyUserOtp = async (req, res) => {
//   try {
//     const phone = normalizePhone(req.body.phone);
//     const otp = String(req.body.otp || "").trim();

//     if (!/^\d{6}$/.test(otp)) {
//       return res.status(400).json({
//         success: false,
//         message: "Enter a valid 6-digit OTP",
//       });
//     }

//     if (!process.env.OTP_SECRET || !process.env.JWT_SECRET) {
//       return res.status(500).json({
//         success: false,
//         message: "Authentication environment variables are missing",
//       });
//     }

//     const user = await User.findOne({ phone });

//     if (!user || !user.OTP || !user.OTPExpires) {
//       return res.status(400).json({
//         success: false,
//         message: "OTP not found. Please request a new OTP",
//       });
//     }

//     if (new Date(user.OTPExpires).getTime() < Date.now()) {
//       user.OTP = undefined;
//       user.OTPExpires = undefined;
//       await user.save();

//       return res.status(400).json({
//         success: false,
//         message: "OTP expired. Please request a new OTP",
//       });
//     }

//     if (!compareOtp(user.OTP, otp)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP",
//       });
//     }

//     const isNewUser = !user.isVerified;

//     user.isVerified = true;
//     user.OTP = undefined;
//     user.OTPExpires = undefined;

//     await user.save();

//     // Each login creates an independent device session
//     const sessionData = await createUserSession(user, req);

//     const isWeb = sessionData.platform === "web";

//     if (isWeb) {
//       // Browser receives refresh token only as HttpOnly cookie
//       setRefreshCookie(res, sessionData.refreshToken);
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Login successful",
//       isNewUser,
//       accessToken: sessionData.accessToken,

//       // Never send web refresh token in JSON
//       ...(isWeb
//         ? {}
//         : {
//             refreshToken: sessionData.refreshToken,
//           }),

//       sessionId: sessionData.sessionId,
//       deviceId: sessionData.deviceId,
//       expiresIn: ACCESS_TOKEN_SECONDS,
//       user: safeUser(user),
//     });
//   } catch (error) {
//     console.error("Verify OTP Error:", error.message);

//     return res
//       .status(error.message.includes("valid 10-digit") ? 400 : 500)
//       .json({
//         success: false,
//         message: error.message || "OTP verification failed",
//       });
//   }
// };

// RESEND OTP
exports.resendUserOtp = async (req, res) => {
  return exports.sendUserOtp(req, res);
};

// REFRESH ACCESS TOKEN
exports.refreshUserToken = async (req, res) => {
  try {
    const platform = String(
      req.body.platform || req.headers["x-client-platform"] || "unknown",
    ).toLowerCase();

    const isWeb = platform === "web";

    // Web: HttpOnly cookie
    // Ionic: refresh token in request body
    const refreshToken = String(
      (isWeb ? req.cookies?.[REFRESH_COOKIE_NAME] : req.body.refreshToken) ||
        "",
    ).trim();

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        code: "REFRESH_TOKEN_REQUIRED",
        message: "Refresh token is required. Please login again.",
      });
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);

    const session = await UserSession.findOne({
      refreshTokenHash,
      revokedAt: null,
    });

    if (!session) {
      if (isWeb) clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        code: "INVALID_REFRESH_TOKEN",
        message: "Session is invalid or logged out. Please login again.",
      });
    }

    const user = await User.findById(session.userId);

    if (!user) {
      await UserSession.updateOne(
        { _id: session._id },
        { $set: { revokedAt: new Date() } },
      );

      if (isWeb) clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found. Please login again.",
      });
    }

    // Stable refresh token: do not rotate it on every refresh.
    // This avoids concurrent refresh requests invalidating each other.
    session.lastUsedAt = new Date();
    await session.save();

    const accessToken = generateAccessToken(user._id, session._id);

    if (isWeb) {
      // Keep browser refresh token in HttpOnly cookie
      setRefreshCookie(res, refreshToken);
    }

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      accessToken,
      expiresIn: ACCESS_TOKEN_SECONDS,

      // Ionic needs the same refresh token returned
      ...(isWeb ? {} : { refreshToken }),
    });
  } catch (error) {
    console.error("Refresh Token Error:", error.message);

    return res.status(500).json({
      success: false,
      code: "REFRESH_FAILED",
      message: "Unable to refresh token",
    });
  }
};

// LOGOUT CURRENT DEVICE SESSION
exports.logoutUser = async (req, res) => {
  try {
    const platform = String(
      req.body.platform || req.headers["x-client-platform"] || "unknown",
    ).toLowerCase();

    const isWeb = platform === "web";

    const refreshToken = String(
      (isWeb ? req.cookies?.[REFRESH_COOKIE_NAME] : req.body.refreshToken) ||
        "",
    ).trim();

    if (refreshToken) {
      const refreshTokenHash = hashRefreshToken(refreshToken);

      await UserSession.updateOne(
        {
          refreshTokenHash,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
          },
        },
      );
    }

    if (isWeb) {
      clearRefreshCookie(res);
    }

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout Error:", error.message);

    // Clear browser cookie even if the DB operation fails
    if (
      String(
        req.body.platform || req.headers["x-client-platform"] || "",
      ).toLowerCase() === "web"
    ) {
      clearRefreshCookie(res);
    }

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

// LOGOUT ALL DEVICES (OPTIONAL API)
exports.logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.userId;

    await UserSession.updateMany(
      {
        userId,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    console.error("Logout All Devices Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to logout from all devices",
    });
  }
};

// SEND ORDER SUCCESS WHATSAPP
exports.sendOrderWhatsApp = async (req, res) => {
  try {
    const {
      phone,
      customerName,
      orderId,
      orderDate,
      orderAmount,
      paymentStatus,
      invoiceUrl,
    } = req.body;

    if (!phone || !orderId || !orderAmount || !invoiceUrl) {
      return res.status(400).json({
        success: false,
        message: "Required order details are missing",
      });
    }

    const result = await sendOrderWhatsApp({
      phone,
      customerName,
      orderId,
      orderDate,
      orderAmount,
      paymentStatus,
      invoiceUrl,
    });

    return res.status(200).json({
      success: true,
      message: "Order WhatsApp sent successfully",
      data: result,
    });
  } catch (error) {
    console.error("Send Order WhatsApp Controller Error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to send order WhatsApp",
    });
  }
};

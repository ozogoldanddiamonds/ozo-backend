
const User = require("../models/user-login");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendOtpSms = require("../utils/send-otp-sms");
const sendOrderWhatsApp = require("../utils/send-order-whatsapp");
const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;

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

const hashOtp = (otp) => {
    return crypto
        .createHmac("sha256", process.env.OTP_SECRET)
        .update(String(otp))
        .digest("hex");
};

const compareOtp = (storedHash, enteredOtp) => {
    const stored = Buffer.from(storedHash, "hex");
    const entered = Buffer.from(hashOtp(enteredOtp), "hex");

    return (
        stored.length === entered.length &&
        crypto.timingSafeEqual(stored, entered)
    );
};
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 30;

const generateAccessToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

const generateRefreshToken = () => {
    return crypto.randomBytes(64).toString("hex");
};

const hashRefreshToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};

const getRefreshTokenExpiry = () => {
    return new Date(
        Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
    );
};
const safeUser = (user) => {
    const data = user.toObject();

    delete data.password;
    delete data.token;
    delete data.OTP;
    delete data.OTPExpires;
    delete data.__v;
    delete data.refreshTokenHash;
    delete data.refreshTokenExpiresAt;
    return data;
};

// SEND OTP
exports.sendUserOtp = async (req, res) => {
    let user;
    let isNewDocument = false;
    let previousOtp;
    let previousExpiry;

    try {
        const phone = normalizePhone(req.body.phone);

        if (!process.env.OTP_SECRET || !process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication environment variables are missing"
            });
        }

        user = await User.findOne({ phone });

        if (user && user.OTPExpires && user.OTP) {
            const previousExpiryTime = new Date(user.OTPExpires).getTime();

            const previousSentTime =
                previousExpiryTime - OTP_EXPIRY_MINUTES * 60 * 1000;

            const elapsedSeconds =
                (Date.now() - previousSentTime) / 1000;

            if (
                elapsedSeconds >= 0 &&
                elapsedSeconds < OTP_RESEND_SECONDS
            ) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${Math.ceil(
                        OTP_RESEND_SECONDS - elapsedSeconds
                    )} seconds before requesting another OTP`
                });
            }
        }

        if (!user) {
            user = new User({
                phone,
                isVerified: false
            });

            isNewDocument = true;
        }

        previousOtp = user.OTP;
        previousExpiry = user.OTPExpires;

        const otp = crypto.randomInt(100000, 1000000).toString();

        user.OTP = hashOtp(otp);
        user.OTPExpires = new Date(
            Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
        );

        await user.save();

        try {
            const smsResult = await sendOtpSms(phone, otp);

            return res.status(200).json({
                success: true,
                message: "OTP sent successfully",
                data: {
                    phone,
                    expiresIn: OTP_EXPIRY_MINUTES * 60,
                    smsReferenceId: smsResult.referenceId,
                    result: smsResult
                }
            });

        } catch (smsError) {
            if (isNewDocument) {
                await User.deleteOne({ _id: user._id });
            } else {
                user.OTP = previousOtp;
                user.OTPExpires = previousExpiry;
                await user.save();
            }

            throw smsError;
        }

    } catch (error) {
        console.error("Send OTP Error:", error.message);

        return res.status(
            error.message.includes("valid 10-digit") ? 400 : 500
        ).json({
            success: false,
            message: error.message || "Unable to send OTP"
        });
    }
};


// VERIFY OTP AND LOGIN
exports.verifyUserOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        const otp = String(req.body.otp || "").trim();

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 6-digit OTP"
            });
        }

        if (!process.env.OTP_SECRET || !process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication environment variables are missing"
            });
        }

        const user = await User.findOne({ phone });

        if (!user || !user.OTP || !user.OTPExpires) {
            return res.status(400).json({
                success: false,
                message: "OTP not found. Please request a new OTP"
            });
        }

        if (new Date(user.OTPExpires).getTime() < Date.now()) {
            user.OTP = undefined;
            user.OTPExpires = undefined;
            await user.save();

            return res.status(400).json({
                success: false,
                message: "OTP expired. Please request a new OTP"
            });
        }

        if (!compareOtp(user.OTP, otp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        const isNewUser = !user.isVerified;

        user.isVerified = true;
        user.OTP = undefined;
        user.OTPExpires = undefined;

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken();

        user.refreshTokenHash = hashRefreshToken(refreshToken);
        user.refreshTokenExpiresAt = getRefreshTokenExpiry();

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Login successful",
            isNewUser,
            accessToken,
            refreshToken,
            expiresIn: 900,
            refreshTokenExpiresIn: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
            user: safeUser(user)
        });

    } catch (error) {
        console.error("Verify OTP Error:", error.message);

        return res.status(
            error.message.includes("valid 10-digit") ? 400 : 500
        ).json({
            success: false,
            message: error.message || "OTP verification failed"
        });
    }
};


exports.resendUserOtp = async (req, res) => {
    return exports.sendUserOtp(req, res);
};


// REFRESH ACCESS TOKEN
exports.refreshUserToken = async (req, res) => {
    try {
        const refreshToken = String(
            req.body.refreshToken || ""
        ).trim();

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        const refreshTokenHash = hashRefreshToken(refreshToken);
        console.log("Incoming refresh token:", refreshToken);
        console.log("Incoming refresh token hash:", refreshTokenHash);
        const user = await User.findOne({
            refreshTokenHash,
            refreshTokenExpiresAt: { $gt: new Date() }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token. Please login again."
            });
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = generateRefreshToken();

        // Rotate refresh token
        user.refreshTokenHash = hashRefreshToken(newRefreshToken);
        user.refreshTokenExpiresAt = getRefreshTokenExpiry();

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: 900,
            refreshTokenExpiresIn: REFRESH_TOKEN_DAYS * 24 * 60 * 60
        });

    } catch (error) {
        console.error("Refresh Token Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to refresh token"
        });
    }
};

// LOGOUT
exports.logoutUser = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.refreshTokenHash = null;
        user.refreshTokenExpiresAt = null;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Logout successful"
        });

    } catch (error) {
        console.error("Logout Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Logout failed"
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
            invoiceUrl
        } = req.body;

        if (!phone || !orderId || !orderAmount || !invoiceUrl) {
            return res.status(400).json({
                success: false,
                message: "Required order details are missing"
            });
        }

        const result = await sendOrderWhatsApp({
            phone,
            customerName,
            orderId,
            orderDate,
            orderAmount,
            paymentStatus,
            invoiceUrl
        });

        return res.status(200).json({
            success: true,
            message: "Order WhatsApp sent successfully",
            data: result
        });

    } catch (error) {

        console.error("Send Order WhatsApp Controller Error:", error.message);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to send order WhatsApp"
        });

    }

};
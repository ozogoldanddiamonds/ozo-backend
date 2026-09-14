const User = require("../models/user-login");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Cart = require("../models/cart");
const Wishlist = require("../models/wishlist");
const Order = require("../models/order");
const {
  transporter
} = require(
  "../middleware/mail"
);
/*
REGISTER
*/
exports.Userregister =
  async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        password
      } = req.body || {};

      if (!phone) {
        return res.status(400).json({
          success: false,
          message:
            "Phone is required"
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          message:
            "Password is required"
        });
      }

      const userExists =
        await User.findOne({
          phone
        });

      if (userExists) {
        return res.status(400).json({
          success: false,
          message:
            "User already exists"
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const user =
        await User.create({
          name,
          phone,
          email,
          password:
            hashedPassword
        });

      res.status(201).json({
        success: true,
        message:
          "Registration successful",
        data: user
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };

exports.userLogin =
  async (req, res) => {
    try {
      const {
        phone,
        password
      } = req.body || {};

      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Phone and Password are required"
        });
      }

      const user =
        await User.findOne({
          phone
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      const isMatch =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid password"
        });
      }

      const token =
        jwt.sign(
          {
            userId:
              user._id
          },
          "secretKey",
          {
            expiresIn: "7d"
          }
        );

      user.token =
        token;

      await user.save();

      res.status(200).json({
        success: true,
        message:
          "Login successful",
        token,
        user
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };


// forgot password
exports.userforgotPassword =
  async (req, res) => {
    try {
      const { email } =
        req.body || {};

      if (!email) {
        return res.status(400).json({
          success: false,
          message:
            "Email is required"
        });
      }

      const user =
        await User.findOne({
          email
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      const otp =
        Math.floor(
          100000 +
          Math.random() * 900000
        ).toString();

      user.OTP = otp;

      user.OTPExpires =
        new Date(
          Date.now() +
          5 * 60 * 1000
        );

      await user.save();

      await transporter.sendMail({
        from:
          "yourgmail@gmail.com",
        to: email,
        subject:
          "Password Reset OTP",
        text:
          `Your OTP is ${otp}`
      });

      res.status(200).json({
        success: true,
        message:
          "OTP sent successfully"
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };


// verify password

exports.verifyOTP =
  async (req, res) => {
    try {
      const {
        email,
        otp
      } = req.body || {};

      const user =
        await User.findOne({
          email
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      if (user.OTP !== otp) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid OTP"
        });
      }

      if (
        new Date() >
        user.OTPExpires
      ) {
        return res.status(400).json({
          success: false,
          message:
            "OTP expired"
        });
      }

      res.status(200).json({
        success: true,
        message:
          "OTP verified successfully"
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };

// Resend OTP
exports.resendOTP =
  async (req, res) => {
    try {
      const { email } =
        req.body || {};

      const user =
        await User.findOne({
          email
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      const otp =
        Math.floor(
          100000 +
          Math.random() * 900000
        ).toString();

      user.OTP = otp;

      user.OTPExpires =
        new Date(
          Date.now() +
          5 * 60 * 1000
        );

      await user.save();

      await transporter.sendMail({
        from:
          "yourgmail@gmail.com",
        to: email,
        subject:
          "Resend OTP",
        text:
          `Your new OTP is ${otp}`
      });

      res.status(200).json({
        success: true,
        message:
          "OTP resent successfully"
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };
// Reset Password

exports.userresetPassword =
  async (req, res) => {
    try {
      const {
        email,
        newPassword
      } = req.body || {};

      const user =
        await User.findOne({
          email
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found"
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          newPassword,
          10
        );

      user.password =
        hashedPassword;

      user.OTP = null;
      user.OTPExpires = null;

      await user.save();

      res.status(200).json({
        success: true,
        message:
          "Password reset successfully"
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };

exports.getAllUsers =
  async (req, res) => {
    try {

      const users =
        await User.find()
          .sort({
            createdAt: -1
          });

      res.status(200).json({
        success: true,
        count:
          users.length,
        data: users
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };

/*
GET USERS COUNT
*/
exports.getUsersCount =
  async (req, res) => {
    try {

      const totalUsers =
        await User.countDocuments();

      res.status(200).json({
        success: true,
        totalUsers
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };

exports.getProfileSummary = async (
  req,
  res
) => {

  try {

    const { userId } =
      req.params;

    // ======================
    // USER
    // ======================

    const user =
      await User.findById(userId)
        .select(
          "name email phone profileImage"
        );

    if (!user) {

      return res.status(404).json({

        success: false,

        message:
          "User not found"

      });

    }

    // ======================
    // CART COUNT
    // ======================

    const cart =
      await Cart.findOne({
        user: userId
      })
        .populate("items.product");

    let cartCount = 0;

    if (cart) {

      const validCartItems = [];

      for (const item of cart.items) {

        const product =
          item.product;

        if (!product) {
          continue;
        }

        const selectedVariant =
          product.variants?.id(
            item.variantId
          );

        if (!selectedVariant) {
          continue;
        }

        validCartItems.push(item);

      }

      // Auto cleanup invalid items

      if (
        validCartItems.length !==
        cart.items.length
      ) {

        cart.items =
          validCartItems;

        await cart.save();

      }

      cartCount =
        validCartItems.length;

    }

    // ======================
    // WISHLIST COUNT
    // ======================

    const wishlist =
      await Wishlist.findOne({
        user: userId
      });

    const wishlistCount =
      wishlist?.items?.length || 0;

    // ======================
    // ORDER COUNT
    // ======================

    const ordersCount =
      await Order.countDocuments({
        user: userId
      });

    // ======================
    // RESPONSE
    // ======================

    return res.status(200).json({

      success: true,

      data: {

        user: {

          _id:
            user._id,

          name:
            user.name,

          email:
            user.email,

          phone:
            user.phone,

          profileImage:
            user.profileImage || ''

        },

        counts: {

          orders:
            ordersCount,

          wishlist:
            wishlistCount,

          cart:
            cartCount

        }

      }

    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

/*
LOGOUT
*/
exports.userLogout = async (req, res) => {
  try {

    const { userId } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.token = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Logout successful"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
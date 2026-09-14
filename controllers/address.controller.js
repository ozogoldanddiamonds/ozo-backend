const Address =
  require("../models/address");


exports.createAddress =
  async (req, res) => {
    try {
      console.log(
        "BODY:",
        req.body
      );

      const {
        user,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        country,
        isDefault
      } = req.body || {};

      if (!user) {
        return res.status(400).json({
          success: false,
          message:
            "User is required"
        });
      }

      if (isDefault) {
        await Address.updateMany(
          { user },
          {
            isDefault: false
          }
        );
      }

      const address =
        await Address.create({
          user,
          fullName,
          phone,
          addressLine1,
          addressLine2,
          city,
          state,
          pincode,
          country,
          isDefault
        });

      res.status(201).json({
        success: true,
        message:
          "Address created successfully",
        data: address
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };

exports.getAddresses =
  async (req, res) => {
    try {
      const addresses =
        await Address.find({
          user: req.params.userId
        });

      res.status(200).json({
        success: true,
        message:
          "Addresses fetched successfully",
        data: addresses
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
GET ALL ADDRESSES
*/
/*

/*
GET ALL ADDRESSES
*/
exports.getAllAddresses =
  async (req, res) => {
    try {

      const addresses =
        await Address.find()
          .populate("user");

      res.status(200).json({
        success: true,
        data: addresses
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
UPDATE ADDRESS
*/
exports.updateAddress =
  async (req, res) => {
    try {
      const {
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        country,
        isDefault
      } = req.body || {};

      const address =
        await Address.findById(
          req.params.id
        );

      if (!address) {
        return res.status(404).json({
          success: false,
          message:
            "Address not found"
        });
      }

      if (isDefault === true) {
        await Address.updateMany(
          {
            user: address.user
          },
          {
            isDefault: false
          }
        );
      }

      address.fullName =
        fullName;

      address.phone =
        phone;

      address.addressLine1 =
        addressLine1;

      address.addressLine2 =
        addressLine2;

      address.city =
        city;

      address.state =
        state;

      address.pincode =
        pincode;

      address.country =
        country;

      address.isDefault =
        isDefault;

      await address.save();

      res.status(200).json({
        success: true,
        message:
          "Address updated successfully",
        data: address
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };

exports.deleteAddress =
  async (req, res) => {
    try {
      const address =
        await Address.findByIdAndDelete(
          req.params.id
        );

      if (!address) {
        return res.status(404).json({
          success: false,
          message:
            "Address not found"
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Address deleted successfully"
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };

exports.getAddressById =
  async (req, res) => {

    try {

      const address =
        await Address.findById(
          req.params.id
        );

      if (!address) {

        return res.status(404).json({

          success: false,

          message:
            "Address not found"

        });

      }

      res.status(200).json({

        success: true,

        data: address

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  };


exports.setDefaultAddress =
  async (req, res) => {

    const address =
      await Address.findById(
        req.params.id
      );

    if (!address) {
      return res.status(404).json({
        success: false
      });
    }

    await Address.updateMany(
      {
        user: address.user
      },
      {
        isDefault: false
      }
    );

    address.isDefault = true;

    await address.save();

    res.status(200).json({
      success: true,
      message:
        "Default address updated"
    });

  };
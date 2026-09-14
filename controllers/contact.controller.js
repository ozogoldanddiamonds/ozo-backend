const Contact =
  require("../models/contact");
const User = require("../models/user-login");

/*
=====================================
CREATE CONTACT
=====================================
*/

exports.createContact =
  async (req, res) => {

    try {

      const {
        user,
        name,
        email,
        phone,
        subject,
        message
      } = req.body;

      // =====================
      // USER VALIDATION
      // =====================

      if (!user) {

        return res.status(400).json({

          success: false,

          message:
            "Please login first"

        });

      }

      const userExists =
        await User.findById(user);

      if (!userExists) {

        return res.status(404).json({

          success: false,

          message:
            "User not found"

        });

      }

      // =====================
      // FORM VALIDATION
      // =====================

      if (
        !name ||
        !email ||
        !phone
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Name, Email and Phone are required"

        });

      }

      // =====================
      // CREATE CONTACT
      // =====================

      const contact =
        await Contact.create({

          user,

          name,

          email,

          phone,

          subject,

          message

        });
      console.log("CONTACT", contact);

      // =====================
      // RESPONSE
      // =====================

      res.status(201).json({

        success: true,

        message:
          "Contact created successfully",

        data:
          contact

      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  };


/*
=====================================
GET ALL CONTACTS
=====================================
*/

exports.getAllContacts = async (req, res) => {
  try {

    const contacts = await Contact.find()
      .populate(
        "user",
        "name phone email createdAt"
      )
      .sort({
        createdAt: -1
      });

    res.status(200).json({
      success: true,
      message: "Contacts fetched successfully",
      data: contacts
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};



/*
=====================================
GET SINGLE CONTACT
=====================================
*/

exports.getContactById =
  async (req, res) => {

    try {

      const contact =
        await Contact.findById(
          req.params.id
        );

      if (!contact) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              "Contact not found"

          });

      }

      res.status(200).json({

        success: true,

        message:
          "Contact fetched successfully",

        data:
          contact

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
=====================================
UPDATE CONTACT
=====================================
*/

exports.updateContact =
  async (req, res) => {

    try {

      const contact =
        await Contact.findById(
          req.params.id
        );

      if (!contact) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              "Contact not found"

          });

      }

      const updatedContact =
        await Contact.findByIdAndUpdate(

          req.params.id,

          req.body,

          {
            new: true
          }

        );

      res.status(200).json({

        success: true,

        message:
          "Contact updated successfully",

        data:
          updatedContact

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
=====================================
DELETE CONTACT
=====================================
*/

exports.deleteContact =
  async (req, res) => {

    try {

      const contact =
        await Contact.findByIdAndDelete(
          req.params.id
        );

      if (!contact) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              "Contact not found"

          });

      }

      res.status(200).json({

        success: true,

        message:
          "Contact deleted successfully"

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  };
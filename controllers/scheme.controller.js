const Scheme = require("../models/scheme");

// =======================
// Create Scheme
// =======================
exports.createScheme = async (req, res) => {

  try {

    let {

      name,

      amount,

      durationMonths = 12,

      userPayMonths = 11,

      companyPayMonths = 1,

      description,

      benefits,

      terms,

      isPopular,

      displayOrder

    } = req.body;

    // =======================
    // VALIDATIONS
    // =======================

    if (!name || !name.trim()) {

      return res.status(400).json({

        success: false,

        message: "Scheme name is required"

      });

    }

    if (!amount || Number(amount) <= 0) {

      return res.status(400).json({

        success: false,

        message: "Valid scheme amount is required"

      });

    }

    if (!description || !description.trim()) {

      return res.status(400).json({

        success: false,

        message: "Description is required"

      });

    }

    amount = Number(amount);
    durationMonths = Number(durationMonths);
    userPayMonths = Number(userPayMonths);
    companyPayMonths = Number(companyPayMonths);

    // =======================
    // MONTH VALIDATION
    // =======================

    if (
      userPayMonths + companyPayMonths !==
      durationMonths
    ) {

      return res.status(400).json({

        success: false,

        message:
          "User Pay Months + Company Pay Months must be equal to Duration Months"

      });

    }

    // =======================
    // DUPLICATE CHECK
    // =======================

    const existingScheme = await Scheme.findOne({

      name: {

        $regex: new RegExp(

          `^${name.trim()}$`,

          "i"

        )

      }

    });

    if (existingScheme) {

      return res.status(400).json({

        success: false,

        message: "Scheme already exists"

      });

    }

    // =======================
    // MONTHLY AMOUNT
    // Customer pays 11 months
    // Company pays last month
    // Monthly installment = Amount / Total Duration
    // =======================

    const monthlyAmount = Number(

      (amount / durationMonths).toFixed(2)

    );

    // =======================
    // CREATE SCHEME
    // =======================

    const scheme = await Scheme.create({

      name: name.trim(),

      amount,

      durationMonths,

      userPayMonths,

      companyPayMonths,

      monthlyAmount,

      description: description.trim(),

      benefits: benefits || [],

      terms: terms || "",

      isPopular: isPopular || false,

      displayOrder: displayOrder || 0

    });

    // =======================
    // RESPONSE
    // =======================

    res.status(201).json({

      success: true,

      message: "Scheme created successfully",

      data: scheme

    });

  }

  catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};


// =======================
// Get All Schemes
// =======================
exports.getAllSchemes = async (req, res) => {
  try {

    const schemes = await Scheme.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: schemes.length,
      data: schemes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



// =======================
// Get Scheme By Id
// =======================
exports.getSchemeById = async (req, res) => {
  try {

    const scheme = await Scheme.findById(req.params.id);

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: "Scheme not found"
      });
    }

    res.status(200).json({
      success: true,
      data: scheme
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



// =======================
// Update Scheme
// =======================
exports.updateScheme = async (req, res) => {

  try {

    const scheme = await Scheme.findById(req.params.id);

    if (!scheme) {

      return res.status(404).json({

        success: false,

        message: "Scheme not found"

      });

    }

    let {

      name,

      amount,

      durationMonths,

      userPayMonths,

      companyPayMonths,

      description,

      benefits,

      terms,

      isPopular,

      displayOrder,

      isActive

    } = req.body;

    // =======================
    // DEFAULT VALUES
    // =======================

    amount = Number(
      amount ?? scheme.amount
    );

    durationMonths = Number(
      durationMonths ?? scheme.durationMonths
    );

    userPayMonths = Number(
      userPayMonths ?? scheme.userPayMonths
    );

    companyPayMonths = Number(
      companyPayMonths ?? scheme.companyPayMonths
    );

    // =======================
    // VALIDATION
    // =======================

    if (

      userPayMonths +

      companyPayMonths !==

      durationMonths

    ) {

      return res.status(400).json({

        success: false,

        message:
          "User Pay Months + Company Pay Months must equal Duration Months"

      });

    }

    // =======================
    // DUPLICATE NAME
    // =======================

    if (name) {

      const duplicate = await Scheme.findOne({

        _id: {
          $ne: req.params.id
        },

        name: {

          $regex: new RegExp(

            `^${name.trim()}$`,

            "i"

          )

        }

      });

      if (duplicate) {

        return res.status(400).json({

          success: false,

          message:
            "Scheme name already exists"

        });

      }

    }

    // =======================
    // MONTHLY AMOUNT
    // =======================

    const monthlyAmount = Number(

      (amount / durationMonths).toFixed(2)

    );

    // =======================
    // UPDATE
    // =======================

    scheme.name =
      name?.trim() || scheme.name;

    scheme.amount =
      amount;

    scheme.durationMonths =
      durationMonths;

    scheme.userPayMonths =
      userPayMonths;

    scheme.companyPayMonths =
      companyPayMonths;

    scheme.monthlyAmount =
      monthlyAmount;

    scheme.description =
      description?.trim() ||
      scheme.description;

    scheme.benefits =
      benefits ??
      scheme.benefits;

    scheme.terms =
      terms ??
      scheme.terms;

    scheme.isPopular =
      isPopular ??
      scheme.isPopular;

    scheme.displayOrder =
      displayOrder ??
      scheme.displayOrder;

    if (
      typeof isActive === "boolean"
    ) {

      scheme.isActive =
        isActive;

    }

    await scheme.save();

    // =======================
    // RESPONSE
    // =======================

    res.status(200).json({

      success: true,

      message:
        "Scheme updated successfully",

      data:
        scheme

    });

  }

  catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

// =======================
// Delete Scheme
// =======================
exports.deleteScheme = async (req, res) => {
  try {

    const scheme = await Scheme.findById(req.params.id);

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: "Scheme not found"
      });
    }

    await Scheme.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Scheme deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



// =======================
// Update Status (Active/Inactive)
// =======================
exports.updateSchemeStatus = async (req, res) => {
  try {

    const { isActive } = req.body;

    const scheme = await Scheme.findById(req.params.id);

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: "Scheme not found"
      });
    }

    scheme.isActive = isActive;

    await scheme.save();

    res.status(200).json({
      success: true,
      message: `Scheme ${isActive ? "Activated" : "Deactivated"} successfully`,
      data: scheme
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
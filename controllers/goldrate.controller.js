const GoldRate = require("../models/gold-rate");


/*
 CREATE GOLD RATE
*/
exports.createGoldRate = async (req, res) => {
  try {

    const { ratePerGram, updatedBy } = req.body;

    if (!ratePerGram) {
      return res.status(400).json({
        success: false,
        message: "Gold rate is required"
      });
    }

    if (!updatedBy) {
      return res.status(400).json({
        success: false,
        message: "Admin id is required"

      });
    }

    const goldRate = await GoldRate.create({
      ratePerGram,
      history: [
        {
          rate: ratePerGram
        }
      ],
      updatedBy
    });

    res.status(201).json({
      success: true,
      message: "Gold rate created successfully",
      data: goldRate
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
 GET ALL GOLD RATES
*/
exports.getAllGoldRates = async (req, res) => {
  try {

    const goldRates = await GoldRate
      .find()
      .populate("updatedBy");

    if (!goldRates.length) {
      return res.status(404).json({
        success: false,
        message: "No gold rates found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Gold rates fetched successfully",
      data: goldRates
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
 GET SINGLE GOLD RATE
*/
exports.getGoldRateById = async (req, res) => {
  try {

    const goldRate = await GoldRate
      .findById(req.params.id)
      .populate("updatedBy");

    if (!goldRate) {
      return res.status(404).json({
        success: false,
        message: "Gold rate not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Gold rate fetched successfully",
      data: goldRate
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
 UPDATE GOLD RATE
*/
exports.updateGoldRate = async (req, res) => {
  try {

    const { ratePerGram, updatedBy } = req.body;

    const goldRate =
      await GoldRate.findById(req.params.id);

    if (!goldRate) {
      return res.status(404).json({
        success: false,
        message: "Gold rate not found"
      });
    }

    if (!ratePerGram) {
      return res.status(400).json({
        success: false,
        message: "New gold rate is required"
      });
    }

    goldRate.history.push({
      rate: ratePerGram
    });

    goldRate.ratePerGram = ratePerGram;
    goldRate.updatedBy = updatedBy;

    await goldRate.save();

    res.status(200).json({
      success: true,
      message: "Gold rate updated successfully",
      data: goldRate
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
 DELETE GOLD RATE
*/
exports.deleteGoldRate = async (req, res) => {
  try {

    const goldRate =
      await GoldRate.findByIdAndDelete(
        req.params.id
      );

    if (!goldRate) {
      return res.status(404).json({
        success: false,
        message: "Gold rate not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Gold rate deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
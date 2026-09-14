const mongoose = require("mongoose");
const sizeChartSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true
    },

    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
        required: true,
        unique: true
    },

    image: {
        type: String,
        required: true
    },

    description: String,

    isActive: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});
module.exports =
    mongoose.models.SizeCharts ||
    mongoose.model("SizeCharts", sizeChartSchema);
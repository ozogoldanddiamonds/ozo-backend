// services/priceCalculator.js

const MetalRate = require("../models/metal-rate");
const StoneRate = require("../models/stone-rate");

const calculateVariantPrice = async (variant) => {

    // =========================
    // METAL RATE
    // =========================

    const metalRate = await MetalRate.findOne({
        metalType: variant.metalType,
        purity: variant.metalPurity,
        isActive: true
    }).lean();

    if (!metalRate) {
        throw new Error(
            `Metal rate not found for ${variant.metalType} ${variant.metalPurity}`
        );
    }

    // =========================
    // METAL VALUE
    // =========================

    const metalValue =
        Number(variant.netWeight) *
        Number(metalRate.ratePerGram);

    // =========================
    // WASTAGE VALUE
    // =========================

    const wastageAmount =
        (metalValue *
            Number(variant.wastagePercentage || 0)) / 100;

    // =========================
    // STONE VALUE
    // =========================

    let stoneValue = 0;

    const updatedStones = [];

    if (variant.stones?.length) {

        for (const stone of variant.stones) {

            const query = {
                stoneType: stone.stoneType,
                stoneCategory: stone.stoneCategory,
                isActive: true
            };

            if (stone.quality) {
                query.quality = stone.quality;
            }

            const stoneRate =
                await StoneRate.findOne(query).lean();

            if (!stoneRate) {

                updatedStones.push({
                    ...stone,
                    stoneValue: 0
                });

                continue;
            }

            const currentStoneValue =
                Number(stone.totalWeight || 0) *
                Number(stoneRate.ratePerUnit);

            stoneValue += currentStoneValue;

            updatedStones.push({

                ...stone,

                stoneValue:
                    Number(currentStoneValue.toFixed(2))

            });

        }
    }

    // =========================
    // MAKING CHARGES
    // =========================

    let makingCharges = 0;

    if (variant.makingChargeType === "percentage") {

        makingCharges =
            (
                (metalValue + stoneValue) *
                Number(variant.makingCharges || 0)
            ) / 100;

    } else {

        makingCharges =
            Number(variant.makingCharges || 0);
    }

    // =========================
    // SUB TOTAL
    // =========================

    const subTotal =
        metalValue +
        wastageAmount +
        stoneValue +
        makingCharges;

    // =========================
    // DISCOUNT
    // =========================

    const discountAmount =
        (
            subTotal *
            Number(variant.discountPercentage || 0)
        ) / 100;

    const afterDiscount =
        subTotal -
        discountAmount;

    // =========================
    // GST (3%)
    // =========================

    const gstPercentage = 3;

    const gstAmount =
        (
            afterDiscount *
            gstPercentage
        ) / 100;

    // =========================
    // FINAL PRICE
    // =========================

    const finalPrice =
        afterDiscount +
        gstAmount;

    return {

        metalRate: metalRate.ratePerGram,

        metalValue: Number(metalValue.toFixed(2)),

        wastageAmount: Number(wastageAmount.toFixed(2)),

        stoneValue: Number(stoneValue.toFixed(2)),

        makingCharges: Number(makingCharges.toFixed(2)),

        discountAmount: Number(discountAmount.toFixed(2)),

        gstAmount: Number(gstAmount.toFixed(2)),

        finalPrice: Number(finalPrice.toFixed(2)),
        stones: updatedStones
    };
};

module.exports = calculateVariantPrice;
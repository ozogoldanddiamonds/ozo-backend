const calculateProductPrices = (
    product,
    ratePerGram
) => {

    const updatedVariants =

        product.variants.map(
            (variant) => {

                // =========================
                // GOLD CALCULATION
                // =========================

                const grossWeight =

                    Number(
                        variant.grossWeight || 0
                    );

                const goldRatePerGram =
                    Number(ratePerGram || 0);

                // GOLD AMOUNT

                const goldAmount =

                    grossWeight *
                    goldRatePerGram;

                // =========================
                // WASTAGE
                // =========================

                const wastagePercentage =

                    Number(
                        variant.wastagePercentage || 0
                    );

                const wastageAmount =

                    (
                        goldAmount *
                        wastagePercentage
                    ) / 100;

                // =========================
                // MAKING CHARGES
                // =========================

                const makingCharges =

                    Number(
                        variant.makingCharges || 0
                    );

                // =========================
                // DIAMOND TOTAL
                // =========================

                let diamondAmount = 0;

                variant.diamonds.forEach(
                    (diamond) => {

                        const singleDiamondPrice =

                            Number(
                                diamond.diamondPrice || 0
                            );

                        const totalDiamonds =

                            Number(
                                diamond.totalDiamonds || 1
                            );

                        diamondAmount +=

                            singleDiamondPrice *
                            totalDiamonds;

                    }
                );

                // =========================
                // SUBTOTAL
                // =========================

                const subtotal =

                    goldAmount +

                    wastageAmount +

                    makingCharges +

                    diamondAmount;

                // =========================
                // DISCOUNT
                // =========================

                const discountPercentage =

                    Number(
                        variant.discountPercentage || 0
                    );

                const discountAmount =

                    (
                        subtotal *
                        discountPercentage
                    ) / 100;

                // =========================
                // FINAL PRICE
                // =========================

                const finalPrice =

                    subtotal -
                    discountAmount;

                // =========================
                // RETURN
                // =========================

                return {

                    ...variant.toObject(),

                    // GOLD

                    goldRatePerGram,

                    goldWeight:
                        grossWeight,

                    goldAmount,

                    // WASTAGE

                    wastagePercentage,

                    wastageAmount,

                    // MAKING

                    makingCharges,

                    // DIAMOND

                    diamondAmount,

                    // TOTALS

                    subtotal,

                    discountPercentage,

                    discountAmount,

                    finalPrice

                };

            }
        );

    return {

        ...product.toObject(),

        variants:
            updatedVariants

    };

};

module.exports =
    calculateProductPrices;
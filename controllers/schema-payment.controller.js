const Payment = require("../models/scheme-payment");
const UserScheme = require("../models/user-schema");

// ======================================
// Create Monthly Installment Payment
// ======================================

exports.createPayment = async (req, res) => {

    try {

        const {

            subscription,

            user,

            paymentMode,

            transactionId,

            gateway = "MANUAL"

        } = req.body;

        // ==========================
        // VALIDATION
        // ==========================

        if (

            !subscription ||

            !user ||

            !paymentMode

        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Subscription, User and Payment Mode are required"

            });

        }

        // ==========================
        // GET USER SCHEME
        // ==========================

        const userScheme =

            await UserScheme.findById(subscription);

        if (!userScheme) {

            return res.status(404).json({

                success: false,

                message:
                    "Subscription not found"

            });

        }

        if (

            String(userScheme.user) !==

            String(user)

        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid user"

            });

        }

        if (

            userScheme.status !== "ACTIVE"

        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Scheme is not active"

            });

        }

        // ==========================
        // INSTALLMENTS COMPLETED
        // ==========================

        if (

            userScheme.remainingInstallments <= 0

        ) {

            return res.status(400).json({

                success: false,

                message:
                    "All installments already completed"

            });

        }

        // ==========================
        // CURRENT MONTH
        // ==========================

        const monthNo =

            userScheme.paidInstallments + 1;

        // ==========================
        // DUPLICATE PAYMENT CHECK
        // ==========================

        const alreadyPaid =

            await Payment.findOne({

                subscription,

                monthNo,

                status: "PAID"

            });

        if (alreadyPaid) {

            return res.status(400).json({

                success: false,

                message:
                    `Installment ${monthNo} already paid`

            });

        }

        // ==========================
        // CREATE PAYMENT
        // ==========================

        const payment =

            await Payment.create({

                subscription,

                user,

                monthNo,

                amount:
                    userScheme.monthlyAmount,

                dueDate:
                    userScheme.nextDueDate,

                paymentDate:
                    new Date(),

                paymentMode,

                gateway,

                transactionId:
                    transactionId || null,

                status: "PAID"

            });

        // ==========================
        // UPDATE USER SCHEME
        // ==========================

        userScheme.paidInstallments += 1;

        userScheme.remainingInstallments -= 1;

        userScheme.totalPaidAmount +=
            userScheme.monthlyAmount;

        // ==========================
        // NEXT DUE DATE
        // ==========================

        if (

            userScheme.remainingInstallments > 0

        ) {

            const nextDue =

                new Date(
                    userScheme.nextDueDate
                );

            nextDue.setMonth(

                nextDue.getMonth() + 1

            );

            userScheme.nextDueDate =
                nextDue;

        }

        // ==========================
        // COMPLETED
        // ==========================

        if (

            userScheme.remainingInstallments === 0

        ) {

            userScheme.companyContribution =
                userScheme.monthlyAmount;

            userScheme.status =
                "MATURED";

        }

        await userScheme.save();

        // ==========================
        // RESPONSE
        // ==========================

        res.status(201).json({

            success: true,

            message:
                "Installment paid successfully",

            data: {

                payment,

                subscription:

                    userScheme

            }

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

// ===============================
// Get All Payments
// ===============================
exports.getAllPayments = async (req, res) => {
    try {

        const payments = await Payment.find();

        res.status(200).json({
            success: true,
            data: payments
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ===============================
// Get Payment By Id
// ===============================
exports.getPaymentById = async (req, res) => {
    try {

        const payment = await Payment.findById(req.params.id)
            .populate("subscription")
            .populate("user");

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        res.status(200).json({
            success: true,
            data: payment
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

exports.updatePayment = async (req, res) => {

    try {

        const payment = await Payment.findById(req.params.id);

        if (!payment) {

            return res.status(404).json({

                success: false,

                message: "Payment not found"

            });

        }

        const {

            paymentMode,

            gateway,

            transactionId,

            gatewayOrderId,

            gatewayPaymentId,

            receiptNo,

            remarks,

            status

        } = req.body;

        // ==========================
        // PAYMENT MODE
        // ==========================

        if (paymentMode)
            payment.paymentMode = paymentMode;

        if (gateway)
            payment.gateway = gateway;

        if (transactionId)
            payment.transactionId = transactionId;

        if (gatewayOrderId)
            payment.gatewayOrderId = gatewayOrderId;

        if (gatewayPaymentId)
            payment.gatewayPaymentId = gatewayPaymentId;

        if (receiptNo)
            payment.receiptNo = receiptNo;

        if (remarks !== undefined)
            payment.remarks = remarks;

        // ==========================
        // STATUS UPDATE
        // ==========================

        if (

            status &&

            status !== payment.status

        ) {

            const subscription =

                await UserScheme.findById(

                    payment.subscription

                );

            if (!subscription) {

                return res.status(404).json({

                    success: false,

                    message: "Subscription not found"

                });

            }

            // FAILED → PAID

            if (

                payment.status === "FAILED" &&

                status === "PAID"

            ) {

                subscription.paidInstallments += 1;

                subscription.remainingInstallments -= 1;

                subscription.totalPaidAmount += payment.amount;

                if (

                    subscription.remainingInstallments <= 0

                ) {

                    subscription.remainingInstallments = 0;

                    subscription.companyContribution =
                        subscription.monthlyAmount;

                    subscription.status = "MATURED";

                }

                else {

                    const nextDue =

                        new Date(

                            subscription.nextDueDate

                        );

                    nextDue.setMonth(

                        nextDue.getMonth() + 1

                    );

                    subscription.nextDueDate =
                        nextDue;

                }

                await subscription.save();

            }

            // PAID → FAILED

            else if (

                payment.status === "PAID" &&

                status === "FAILED"

            ) {

                subscription.paidInstallments -= 1;

                subscription.remainingInstallments += 1;

                subscription.totalPaidAmount -= payment.amount;

                subscription.status = "ACTIVE";

                const previousDue =

                    new Date(

                        subscription.nextDueDate

                    );

                previousDue.setMonth(

                    previousDue.getMonth() - 1

                );

                subscription.nextDueDate =
                    previousDue;

                await subscription.save();

            }

            payment.status = status;

        }

        await payment.save();

        res.status(200).json({

            success: true,

            message: "Payment updated successfully",

            data: payment

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

// ===============================
// Delete Payment
// ===============================
exports.deletePayment = async (req, res) => {
    try {

        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        await Payment.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "Payment deleted successfully"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

exports.getUserPayments = async (req, res) => {

    try {

        const { userId } = req.params;

        const payments = await Payment.find({

            user: userId

        })

            .populate({

                path: "subscription",

                select:
                    "schemeName monthlyAmount nextDueDate status"

            })

            .sort({

                paymentDate: -1

            });

        res.status(200).json({

            success: true,

            count: payments.length,

            data: payments

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

exports.getPaymentHistory = async (req, res) => {

    try {

        const { subscriptionId } = req.params;

        const subscription =

            await UserScheme.findById(subscriptionId)

                .populate({

                    path: "scheme"

                })

                .populate({

                    path: "user",

                    select:
                        "name phone email"

                });

        if (!subscription) {

            return res.status(404).json({

                success: false,

                message: "Subscription not found"

            });

        }

        const payments =

            await Payment.find({

                subscription: subscriptionId

            })

                .sort({

                    monthNo: 1

                });

        res.status(200).json({

            success: true,

            data: {

                subscription,

                payments

            }

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
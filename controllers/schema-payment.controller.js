const mongoose = require("mongoose");
const crypto = require("crypto");
const Payment = require("../models/scheme-payment");
const UserScheme = require("../models/user-schema");
const SchemePaymentAttempt = require("../models/scheme-payment-attempt");
const razorpay = require("../config/razorpay");




exports.createSchemeRazorpayOrder = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { subscriptionId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        if (!subscriptionId || !mongoose.isValidObjectId(subscriptionId)) {
            return res.status(400).json({
                success: false,
                message: "Valid subscription ID is required"
            });
        }

        const userScheme = await UserScheme.findOne({
            _id: subscriptionId,
            user: userId
        });

        if (!userScheme) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found"
            });
        }

        if (userScheme.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Scheme is not active"
            });
        }

        if (userScheme.remainingInstallments <= 0) {
            return res.status(400).json({
                success: false,
                message: "All installments are already completed"
            });
        }

        const monthNo = userScheme.paidInstallments + 1;
        const amount = Number(userScheme.monthlyAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid installment amount"
            });
        }

        const amountInPaise = Math.round(amount * 100);

        // Check whether this installment is already paid.
        const alreadyPaid = await Payment.findOne({
            subscription: userScheme._id,
            monthNo,
            status: "PAID"
        });

        if (alreadyPaid) {
            return res.status(409).json({
                success: false,
                message: `Installment ${monthNo} is already paid`
            });
        }

        // Find existing unpaid payment attempt.
        const existingAttempt = await SchemePaymentAttempt.findOne({
            subscription: userScheme._id,
            user: userId,
            monthNo,
            status: "CREATED"
        }).sort({ createdAt: -1 });

        if (existingAttempt) {

            // Fetch actual Razorpay order status.
            const existingOrder = await razorpay.orders.fetch(
                existingAttempt.razorpayOrderId
            );

            // IMPORTANT: Do not reopen an already paid order.
            if (existingOrder.status === "paid") {

                const orderPayments = await razorpay.orders.fetchPayments(
                    existingAttempt.razorpayOrderId
                );

                const capturedPayment = orderPayments.items?.find(
                    payment =>
                        payment.status === "captured" &&
                        payment.order_id === existingAttempt.razorpayOrderId &&
                        payment.amount === Math.round(
                            Number(existingAttempt.amount) * 100
                        ) &&
                        payment.currency === existingAttempt.currency
                );

                if (!capturedPayment) {
                    return res.status(409).json({
                        success: false,
                        message: "Razorpay order is paid, but captured payment could not be verified. Please contact support.",
                        paymentAttemptId: existingAttempt._id
                    });
                }

                // Recover the successful payment into our database.
                const recoveryResult = await completeSchemeInstallment({
                    attemptId: existingAttempt._id,
                    userId,
                    razorpayPaymentId: capturedPayment.id
                });

                return res.status(200).json({
                    success: true,
                    message: "Previous successful payment recovered",
                    data: {
                        status: "INSTALLMENT_PAID",
                        payment: recoveryResult.payment,
                        subscription: recoveryResult.subscription
                    }
                });
            }

            // Reuse only orders that can still accept a payment.
            if (
                existingOrder.status === "created" ||
                existingOrder.status === "attempted"
            ) {
                return res.status(200).json({
                    success: true,
                    message: "Existing payment order retrieved",
                    data: {
                        paymentAttemptId: existingAttempt._id,
                        razorpayOrderId: existingAttempt.razorpayOrderId,
                        amount: Math.round(
                            Number(existingAttempt.amount) * 100
                        ),
                        currency: existingAttempt.currency,
                        keyId: process.env.RAZORPAY_KEY_ID,
                        monthNo: existingAttempt.monthNo
                    }
                });
            }

            return res.status(409).json({
                success: false,
                message: "Existing payment order cannot be reused. Please contact support.",
                orderStatus: existingOrder.status
            });
        }

        // Create a new Razorpay order for this one installment.
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `SCH_${userScheme._id}_${monthNo}_${Date.now()}`,
            notes: {
                type: "SCHEME_INSTALLMENT",
                userId: String(userId),
                subscriptionId: String(userScheme._id),
                monthNo: String(monthNo)
            }
        });

        const attempt = await SchemePaymentAttempt.create({
            user: userId,
            subscription: userScheme._id,
            monthNo,
            amount,
            currency: "INR",
            razorpayOrderId: razorpayOrder.id,
            status: "CREATED"
        });

        return res.status(201).json({
            success: true,
            message: "Scheme payment order created",
            data: {
                paymentAttemptId: attempt._id,
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                monthNo
            }
        });

    } catch (error) {
        console.error("CREATE SCHEME RAZORPAY ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create scheme payment order",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined
        });
    }
};



// ==========================================
// COMPLETE INSTALLMENT AFTER VERIFICATION
// ==========================================


const completeSchemeInstallment = async ({
    attemptId,
    userId,
    razorpayPaymentId
}) => {
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {

            // 1. Find payment attempt
            const attempt = await SchemePaymentAttempt.findOne({
                _id: attemptId,
                user: userId
            }).session(session);

            if (!attempt) {
                throw new Error("Payment attempt not found");
            }

            // 2. Idempotency check
            if (attempt.status === "INSTALLMENT_PAID") {

                const existingPayment = await Payment.findById(
                    attempt.payment
                ).session(session);

                const existingSubscription = await UserScheme.findById(
                    attempt.subscription
                ).session(session);

                if (!existingPayment || !existingSubscription) {
                    throw new Error(
                        "Previously completed payment record not found"
                    );
                }

                // Prevent same payment ID from being used for another attempt.
                if (
                    attempt.razorpayPaymentId &&
                    attempt.razorpayPaymentId !== razorpayPaymentId
                ) {
                    throw new Error(
                        "Payment attempt is already completed with another payment ID"
                    );
                }

                result = {
                    payment: existingPayment,
                    subscription: existingSubscription,
                    alreadyCompleted: true
                };

                return;
            }

            // 3. Validate attempt status
            if (!["CREATED", "PAID"].includes(attempt.status)) {
                throw new Error(
                    "Payment attempt cannot be processed"
                );
            }

            // 4. Prevent duplicate Razorpay payment ID
            const duplicateGatewayPayment = await Payment.findOne({
                gatewayPaymentId: razorpayPaymentId,
                status: "PAID"
            }).session(session);

            if (duplicateGatewayPayment) {
                throw new Error(
                    "This Razorpay payment has already been used"
                );
            }

            // 5. Find eligible subscription
            const userScheme = await UserScheme.findOne({
                _id: attempt.subscription,
                user: userId,
                status: "ACTIVE",
                paidInstallments: attempt.monthNo - 1,
                remainingInstallments: { $gt: 0 }
            }).session(session);

            if (!userScheme) {

                const existingPayment = await Payment.findOne({
                    subscription: attempt.subscription,
                    monthNo: attempt.monthNo,
                    status: "PAID"
                }).session(session);

                if (existingPayment) {
                    throw new Error(
                        `Installment ${attempt.monthNo} is already paid`
                    );
                }

                throw new Error(
                    "Subscription installment is no longer eligible for payment"
                );
            }

            // 6. Validate installment number
            if (
                attempt.monthNo !== userScheme.paidInstallments + 1
            ) {
                throw new Error(
                    "Invalid installment number"
                );
            }

            // 7. Validate installment amount
            const expectedAmount = Math.round(
                Number(userScheme.monthlyAmount) * 100
            );

            const attemptAmount = Math.round(
                Number(attempt.amount) * 100
            );

            if (
                !Number.isFinite(expectedAmount) ||
                expectedAmount <= 0 ||
                expectedAmount !== attemptAmount
            ) {
                throw new Error(
                    "Installment amount mismatch"
                );
            }

            // 8. Calculate installment progress
            const dueDate = userScheme.nextDueDate
                ? new Date(userScheme.nextDueDate)
                : null;

            if (!dueDate || Number.isNaN(dueDate.getTime())) {
                throw new Error(
                    "Invalid installment due date"
                );
            }

            const nextPaidCount =
                userScheme.paidInstallments + 1;

            const nextRemaining =
                userScheme.remainingInstallments - 1;

            const isLastCustomerInstallment =
                nextRemaining === 0;

            // 9. Calculate next due date
            // Advance payment is allowed.
            // No due-date restriction is applied.

            let nextDueDate = null;

            if (!isLastCustomerInstallment) {

                nextDueDate = new Date(dueDate);

                const originalDay = nextDueDate.getDate();

                nextDueDate.setDate(1);

                nextDueDate.setMonth(
                    nextDueDate.getMonth() + 1
                );

                const lastDayOfNextMonth = new Date(
                    nextDueDate.getFullYear(),
                    nextDueDate.getMonth() + 1,
                    0
                ).getDate();

                nextDueDate.setDate(
                    Math.min(originalDay, lastDayOfNextMonth)
                );
            }

            // 10. Create PAID payment record
            const [payment] = await Payment.create(
                [{
                    subscription: userScheme._id,
                    user: userId,
                    monthNo: attempt.monthNo,
                    amount: userScheme.monthlyAmount,
                    dueDate,
                    paymentDate: new Date(),
                    paymentMode: "ONLINE",
                    gateway: "RAZORPAY",
                    transactionId: razorpayPaymentId,
                    gatewayOrderId: attempt.razorpayOrderId,
                    gatewayPaymentId: razorpayPaymentId,
                    status: "PAID",
                    remarks: `Razorpay installment payment - Month ${attempt.monthNo}`
                }],
                { session }
            );

            // 11. Prepare subscription update
            const updateFields = {};

            if (nextDueDate) {
                updateFields.nextDueDate = nextDueDate;
            }

            // IMPORTANT:
            // Do not mark MATURED after 11 customer installments.
            // Do not add company contribution here.
            //
            // Customer must wait until the complete 12-month
            // maturity duration is reached.

            // 12. Update UserScheme atomically
            const updatedScheme = await UserScheme.findOneAndUpdate(
                {
                    _id: userScheme._id,
                    user: userId,
                    status: "ACTIVE",
                    paidInstallments: attempt.monthNo - 1,
                    remainingInstallments: { $gt: 0 }
                },
                {
                    $inc: {
                        paidInstallments: 1,
                        remainingInstallments: -1,
                        totalPaidAmount: userScheme.monthlyAmount
                    },
                    ...(Object.keys(updateFields).length > 0
                        ? {
                            $set: updateFields
                        }
                        : {})
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedScheme) {
                throw new Error(
                    "Subscription update failed. Payment transaction rolled back."
                );
            }

            // 13. Update payment attempt
            attempt.status = "INSTALLMENT_PAID";
            attempt.razorpayPaymentId = razorpayPaymentId;
            attempt.payment = payment._id;

            await attempt.save({ session });

            // 14. Final result
            result = {
                payment,
                subscription: updatedScheme,
                alreadyCompleted: false,
                lastCustomerInstallment: isLastCustomerInstallment
            };
        });

        return result;

    } finally {
        await session.endSession();
    }
};



// ==========================================
// VERIFY SCHEME RAZORPAY PAYMENT
// ==========================================

exports.verifySchemeRazorpayPayment = async (req, res) => {
    try {
        // 1. Authenticated user
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        // 2. Request body
        const {
            paymentAttemptId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (
            !paymentAttemptId ||
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                message: "Required payment details are missing"
            });
        }

        // 3. Validate Razorpay configuration
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error("RAZORPAY_KEY_SECRET is missing");

            return res.status(500).json({
                success: false,
                message: "Payment gateway configuration error"
            });
        }

        // 4. Find payment attempt belonging to authenticated user
        const attempt = await SchemePaymentAttempt.findOne({
            _id: paymentAttemptId,
            user: userId,
            razorpayOrderId: razorpay_order_id
        });

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: "Scheme payment attempt not found"
            });
        }

        // 5. Idempotency check
        if (attempt.status === "INSTALLMENT_PAID") {

            const payment = await Payment.findById(attempt.payment);

            const subscription = await UserScheme.findById(
                attempt.subscription
            );

            return res.status(200).json({
                success: true,
                message: "Installment already paid",
                data: {
                    status: "INSTALLMENT_PAID",
                    payment,
                    subscription
                }
            });
        }

        // 6. Validate attempt status
        if (!["CREATED", "PAID"].includes(attempt.status)) {
            return res.status(409).json({
                success: false,
                message: "This payment attempt cannot be processed",
                status: attempt.status
            });
        }

        // 7. Verify Razorpay checkout signature
        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                `${razorpay_order_id}|${razorpay_payment_id}`
            )
            .digest("hex");

        const expectedBuffer = Buffer.from(
            expectedSignature,
            "hex"
        );

        const receivedBuffer = Buffer.from(
            razorpay_signature,
            "hex"
        );

        if (
            expectedBuffer.length !== receivedBuffer.length ||
            !crypto.timingSafeEqual(
                expectedBuffer,
                receivedBuffer
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid Razorpay payment signature"
            });
        }

        // 8. Fetch actual payment details from Razorpay
        const razorpayPayment = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        // 9. Verify order, amount and currency
        const expectedAmount = Math.round(
            Number(attempt.amount) * 100
        );

        if (
            razorpayPayment.order_id !== attempt.razorpayOrderId ||
            razorpayPayment.amount !== expectedAmount ||
            razorpayPayment.currency !== attempt.currency
        ) {
            return res.status(400).json({
                success: false,
                message: "Razorpay payment details do not match"
            });
        }

        // 10. Check captured payment
        if (razorpayPayment.status !== "captured") {
            return res.status(409).json({
                success: false,
                message: "Payment is not captured yet",
                paymentStatus: razorpayPayment.status
            });
        }

        // 11. Verify payment belongs to expected Razorpay order
        if (
            !razorpayPayment.id ||
            razorpayPayment.id !== razorpay_payment_id
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid Razorpay payment ID"
            });
        }

        // 12. Complete scheme installment
        const result = await completeSchemeInstallment({
            attemptId: attempt._id,
            userId: userId,
            razorpayPaymentId: razorpay_payment_id
        });

        // 13. Final response
        return res.status(200).json({
            success: true,
            message: result.alreadyCompleted
                ? "Installment already paid"
                : "Scheme installment paid successfully",
            data: {
                status: "INSTALLMENT_PAID",
                payment: result.payment,
                subscription: result.subscription
            }
        });

    } catch (error) {

        console.error(
            "VERIFY SCHEME RAZORPAY PAYMENT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Payment verification or installment processing failed",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined
        });
    }
};

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
// ===============================
// Get All Payments
// ===============================
exports.getAllPayments = async (req, res) => {
    try {

        const payments = await Payment.find()
            .populate('user', 'name email phone');

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
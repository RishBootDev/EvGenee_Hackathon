const express = require("express");
const router = express.Router();
const razorpay = require("../controllers/rajorpay.controller");
const Payment = require("../models/payment.model");


router.post("/create-order", async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const options = {
      amount: amount * 100,
      currency: currency || "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);


    const payment = new Payment({
      orderId: order.id,
      amount: order.amount / 100,
      currency: order.currency,
    });
    await payment.save();

    res.status(200).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.post("/update-payment", async (req, res) => {
  try {
    const { orderId, paymentId, status } = req.body;

    const payment = await Payment.findOneAndUpdate(
      { orderId },
      { paymentId, status },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.status(200).json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

module.exports = router;
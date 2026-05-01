const Razorpay = require("razorpay");
const {RAZORPAY_KEY_ID,RAZORPAY_KEY_SECRET}=require('../config/config');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpay;
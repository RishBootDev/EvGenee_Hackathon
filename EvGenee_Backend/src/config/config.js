const dotenv=require('dotenv').config();

const PORT=process.env.PORT;
const MONGO_URI=process.env.MONGO_URI;
const JWT_KEY=process.env.JWT_KEY;
const RAZORPAY_KEY_ID=process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET=process.env.RAZORPAY_KEY_SECRET;

if(!PORT || !MONGO_URI ||!JWT_KEY || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET ){
    throw new Error ("Environment Variable not provided");
}


module.exports={
    PORT,
    MONGO_URI,
    JWT_KEY,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
}
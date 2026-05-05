const dotenv=require('dotenv').config();

const PORT=process.env.PORT;
const MONGO_URI=process.env.MONGO_URI;
const JWT_KEY=process.env.JWT_KEY;
const RAZORPAY_KEY_ID=process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET=process.env.RAZORPAY_KEY_SECRET;
const NODEMAILER_USER=process.env.NODEMAILER_USER;
const NODEMAILER_PASS=process.env.NODEMAILER_PASS;
const NODEMAILER_PORT=process.env.NODEMAILER_PORT;
const GROQ_API_KEY=process.env.GROQ_API_KEY;

const PLATFORM_FEE_PERCENTAGE=process.env.PLATFORM_FEE_PERCENTAGE || 5;

if(!PORT || !MONGO_URI ||!JWT_KEY || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !NODEMAILER_USER || !NODEMAILER_PASS || !NODEMAILER_PORT || !GROQ_API_KEY){
    throw new Error ("Environment Variable not provided");
}


module.exports={
    PORT,
    MONGO_URI,
    JWT_KEY,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    NODEMAILER_USER,
    NODEMAILER_PASS,
    NODEMAILER_PORT,
    GROQ_API_KEY,
    PLATFORM_FEE_PERCENTAGE: Number(PLATFORM_FEE_PERCENTAGE)
}
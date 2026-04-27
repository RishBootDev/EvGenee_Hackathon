const dotenv=require('dotenv').config();

const PORT=process.env.PORT;
const MONGO_URI=process.env.MONGO_URI;
const JWT_KEY=process.env.JWT_KEY;

if(!PORT || !MONGO_URI ||!JWT_KEY){
    throw new Error ("Environment Variable not provided");
}


module.exports={
    PORT,
    MONGO_URI,
    JWT_KEY
}
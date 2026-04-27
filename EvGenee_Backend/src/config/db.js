const mongoose=require('mongoose');
const {MONGO_URI}=require('./config');
 async function Connectdb(){

 try{
       await mongoose.connect(MONGO_URI);
 }
 catch(err){
    console.log(err);
    process.exit(1);
 }

}

module.exports=Connectdb;
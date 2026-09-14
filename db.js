// const mongoose= require ("mongoose");
// const connectDB = async ()=>{
//     try{
//         const conn = await mongoose.connect( "mongodb+srv://maddisettivennela184:vennela%40123@cluster0.znayqfx.mongodb.net/OZO_backend?retryWrites=true&w=majority&appName=Cluster0"
// )
//         console.log ("message:server connection is success");
//     }
//     catch(error){
// console.log("message: connect fail");
// process.exit(1);
//     }
// };
// module.exports=connectDB;
const mongoose = require("mongoose");

const connectDB = async () => {
  try {

    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log("message: server connection is success");

  } catch (error) {

    console.log("message: connect fail");
    console.log(error);

    process.exit(1);
  }
};

module.exports = connectDB;


require("dotenv").config();
const express= require("express");
const http= require("http");

const connectDB=require("./db");
const cors = require("cors");
const router= require("./router/router");



const app = express();

const server= http.createServer(app);

connectDB();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(cors());



app.get('/',(req,res)=>{
 res.send("API working");
});

 app.use("/api",router );

 const PORT = process.env.PORT || 3001;
  server.listen(PORT,()=>{
     console.log(`server running at http://localhost:${PORT}`);
  });

  process.on("uncaughtException", (err) => {
  console.log("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("Unhandled Rejection:", err);
});

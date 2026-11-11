import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "node:dns";
import userRouter from "./routers/userRouter.js";
import productRouter from "./routers/productRouter.js";
import categoryRouter from "./routers/categoryRouter.js";
import orderRouter from "./routers/orderRouter.js";
import cartRouter from "./routers/cartRouter.js";
import uploadRouter from "./routers/uploadRouter.js";
import reviewRouter from "./routers/reviewRouter.js";
import addressRouter from "./routers/addressRouter.js";
import wishlistRouter from "./routers/wishlistRouter.js";
import paymentRouter from "./routers/paymentRouter.js";
import passwordRouter from "./routers/passwordRouter.js";
import customRequestRouter from "./routers/customRequestRouter.js";

dotenv.config();

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/users", userRouter);
app.use("/products", productRouter);
app.use("/cart", cartRouter);
app.use("/categories", categoryRouter);
app.use("/orders", orderRouter);
app.use("/upload", uploadRouter);
app.use("/reviews", reviewRouter);
app.use("/addresses", addressRouter);
app.use("/wishlist", wishlistRouter);
app.use("/payments", paymentRouter);
app.use("/password", passwordRouter);
app.use("/custom-requests", customRequestRouter);

app.get("/", (req, res) => {
  res.send("Welcome to the Furniva API!");
});

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully");

    app.listen(PORT, () => {
      console.log(`Furniva server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
};

startServer();

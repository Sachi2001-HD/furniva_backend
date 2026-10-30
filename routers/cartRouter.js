import express from "express";

import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cartController.js";

import { authenticate } from "../middlewares/authenticate.js";

const cartRouter = express.Router();

cartRouter.use(authenticate);
cartRouter.get("/", getCart);
cartRouter.post("/add", addToCart);
cartRouter.put("/update/:productId", updateCartItem);
cartRouter.delete("/remove/:productId", removeCartItem);
cartRouter.delete("/clear", clearCart);

export default cartRouter;

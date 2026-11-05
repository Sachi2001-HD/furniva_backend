import express from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist,
} from "../controllers/wishlistController.js";

import { authenticate } from "../middlewares/authenticate.js";

const wishlistRouter = express.Router();

wishlistRouter.use(authenticate);

wishlistRouter.get("/", getWishlist);
wishlistRouter.post("/add", addToWishlist);
wishlistRouter.post("/toggle", toggleWishlist);
wishlistRouter.delete("/remove/:productId", removeFromWishlist);
wishlistRouter.delete("/clear", clearWishlist);

export default wishlistRouter;

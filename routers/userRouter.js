import express from "express";
import {
  registerUser,
  loginUser,
  getMyProfile,
  updateMyProfile,
  changePassword,
} from "../controllers/userController.js";
import { authenticate } from "../middlewares/authenticate.js";

const userRouter = express.Router();

userRouter.post("/signup", registerUser);
userRouter.post("/login", loginUser);

// Protected
userRouter.get("/me", authenticate, getMyProfile);
userRouter.put("/me", authenticate, updateMyProfile);
userRouter.put("/me/password", authenticate, changePassword);

export default userRouter;
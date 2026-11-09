import express from "express";

import {
  registerUser,
  loginUser,
  googleLogin,
  getMyProfile,
  updateMyProfile,
  changePassword,
} from "../controllers/userController.js";

import { authenticate } from "../middlewares/authenticate.js";

const userRouter = express.Router();

// Authentication
userRouter.post("/signup", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/google", googleLogin);

// Protected profile routes
userRouter.get("/me", authenticate, getMyProfile);
userRouter.patch("/me", authenticate, updateMyProfile);

// Password management
userRouter.put("/me/password", authenticate, changePassword);

export default userRouter
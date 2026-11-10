import express from "express";
import {
  forgotPassword,
  validateResetToken,
  resetPassword,
} from "../controllers/passwordController.js";

const router = express.Router();

router.post("/forgot", forgotPassword);
router.get("/validate", validateResetToken);
router.post("/reset", resetPassword);

export default router;
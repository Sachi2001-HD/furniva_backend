import express from "express";
import {
  createConsultation,
  getMyConsultations,
  cancelMyConsultation,
  getAllConsultations,
  updateConsultation,
} from "../controllers/consultationController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";
import { optionalAuthenticate } from "../middlewares/optionalAuth.js";

const router = express.Router();

router.post("/", optionalAuthenticate, createConsultation);

// Customers
router.get("/my", authenticate, getMyConsultations);
router.patch("/:id/cancel", authenticate, cancelMyConsultation);

// Admin
router.get("/", authenticate, adminOnly, getAllConsultations);
router.patch("/:id", authenticate, adminOnly, updateConsultation);

export default router;
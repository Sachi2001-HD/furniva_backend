import express from "express";
import {
  createConsultation,
  getMyConsultations,
  cancelMyConsultation,
  getAllConsultations,
  updateConsultation,
} from "../controllers/consultationController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createConsultation);
router.get("/my", getMyConsultations);
router.get("/", adminOnly, getAllConsultations);
router.patch("/:id/cancel", cancelMyConsultation);
router.patch("/:id", adminOnly, updateConsultation);

export default router;
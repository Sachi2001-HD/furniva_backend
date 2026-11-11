import express from "express";
import {
  createCustomRequest,
  getMyCustomRequests,
  getCustomRequestById,
  cancelMyRequest,
  acceptQuote,
  getAllCustomRequests,
  updateRequestStatus,
  setQuote,
} from "../controllers/customRequestController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createCustomRequest);
router.get("/my", getMyCustomRequests);
router.get("/", adminOnly, getAllCustomRequests);
router.get("/:id", getCustomRequestById);
router.patch("/:id/cancel", cancelMyRequest);
router.patch("/:id/accept", acceptQuote);
router.patch("/:id/status", adminOnly, updateRequestStatus);
router.patch("/:id/quote", adminOnly, setQuote);

export default router;
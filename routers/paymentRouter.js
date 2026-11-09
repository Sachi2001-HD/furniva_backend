import express from "express";
import {
  getOrderPayment,
  submitReceipt,
  listPayments,
  getPaymentById,
  updatePaymentStatus,
} from "../controllers/paymentController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const router = express.Router();

router.use(authenticate);

// Customers
router.get("/order/:orderId", getOrderPayment);
router.post("/order/:orderId/receipt", submitReceipt);

// Admin
router.get("/", adminOnly, listPayments);
router.get("/:id", adminOnly, getPaymentById);
router.patch("/:id/status", adminOnly, updatePaymentStatus);

export default router;
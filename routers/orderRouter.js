import express from "express";
import {
  createOrder,
  quoteOrder,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const router = express.Router();

router.post("/", authenticate, createOrder);
router.post("/quote", authenticate, quoteOrder);
router.get("/my", authenticate, getMyOrders);
router.get("/", authenticate, adminOnly, getAllOrders);
router.get("/:id", authenticate, getOrderById);
router.patch("/:id/cancel", authenticate, cancelMyOrder);
router.patch("/:id/status", authenticate, adminOnly, updateOrderStatus);

export default router;
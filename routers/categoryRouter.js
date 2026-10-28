import express from "express";
import {
  getCategories,
  getAdminCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  setCategoryStatus,
} from "../controllers/categoryController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const router = express.Router();

router.get("/", getCategories);
router.get("/admin/all", authenticate, adminOnly, getAdminCategories);
router.get("/:id", getCategoryById);

router.post("/", authenticate, adminOnly, createCategory);
router.put("/:id", authenticate, adminOnly, updateCategory);
router.patch("/:id/status", authenticate, adminOnly, setCategoryStatus);

export default router;
import express from "express";
import {
  getCategories,
  getAdminCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  setCategoryStatus,
  deleteCategory,
} from "../controllers/categoryController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const router = express.Router();

router.get("/", getCategories);
router.get("/admin/all", authenticate, adminOnly, getAdminCategories);
router.get("/:id", getCategoryById);

router.post("/", authenticate, adminOnly, createCategory);
router.put("/:id", authenticate, adminOnly, updateCategory);
router.patch("/:id/status", authenticate, adminOnly, setCategoryStatus);
router.delete("/:id", authenticate, adminOnly, deleteCategory);

export default router;
import express from "express";
import {
  getProducts,
  getAdminProducts,
  getProductById,
  createProduct,
  updateProduct,
  setProductStatus,
} from "../controllers/productController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const router = express.Router();

router.get("/", getProducts);
router.get("/admin/all", authenticate, adminOnly, getAdminProducts); 
router.get("/:id", getProductById);

router.post("/", authenticate, adminOnly, createProduct);
router.put("/:id", authenticate, adminOnly, updateProduct);
router.patch("/:id/status", authenticate, adminOnly, setProductStatus);

export default router;
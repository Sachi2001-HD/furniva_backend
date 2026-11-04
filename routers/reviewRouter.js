import express from "express";

import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  getAllReviews,
  updateReviewStatus,
  adminDeleteReview,
} from "../controllers/reviewController.js";

import {
  authenticate,
  adminOnly,
} from "../middlewares/authenticate.js";

const router = express.Router();

// Customer routes
router.post("/:productId", authenticate, createReview);
router.get("/:productId", getProductReviews);
router.put("/my-review/:reviewId", authenticate, updateReview);
router.delete("/my-review/:reviewId", authenticate, deleteReview);

// Admin routes
router.get("/admin/all", authenticate, adminOnly, getAllReviews);

router.patch(
  "/admin/:reviewId/approve",
  authenticate,
  adminOnly,
  updateReviewStatus
);

router.delete(
  "/admin/:reviewId",
  authenticate,
  adminOnly,
  adminDeleteReview
);

export default router;

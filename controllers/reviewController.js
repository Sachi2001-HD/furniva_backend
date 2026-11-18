import mongoose from "mongoose";
import Review from "../models/review.js";
import Product from "../models/product.js";
import Order from "../models/order.js";

const displayName = (user) => {
  const first = user.firstName?.trim() || "A customer";
  const initial = user.lastName?.trim()?.[0];

  return initial && /\p{L}/u.test(initial)
    ? `${first} ${initial.toUpperCase()}.`
    : first;
};

// Create a review
export const createReview = async (req, res) => {
  try {
    const { rating, comment = "" } = req.body;
    const { productId } = req.params;
    const userId = req.user.id || req.user._id;

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // Validate rating
    if (
      rating === undefined ||
      !Number.isInteger(Number(rating)) ||
      Number(rating) < 1 ||
      Number(rating) > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
    }

    // Validate optional comment
    if (typeof comment !== "string" || comment.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Review comment must be 1000 characters or fewer",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const deliveredOrder = await Order.findOne({
      user: userId,
      status: "Delivered",
      "items.product": productId,
    });

    if (!deliveredOrder) {
      return res.status(403).json({
        success: false,
        message: "You can review this product after it has been delivered.",
      });
    }

    // Prevent duplicate reviews
    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    const review = await Review.create({
      product: productId,
      user: userId,
      rating: Number(rating),
      comment: comment.trim(),
    });

    await review.populate("user", "firstName lastName image");

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    console.error("Create review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit review",
    });
  }
};

// Get reviews for a product
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const reviews = await Review.find({
      product: productId,
      isApproved: true,
    })
      .populate("user", "firstName lastName image")
      .sort({ createdAt: -1 });

    const totalReviews = reviews.length;

    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        : 0;

    return res.status(200).json({
      success: true,
      totalReviews,
      averageRating: Number(averageRating.toFixed(1)),
      reviews,
    });
  } catch (error) {
    console.error("Get product reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve reviews",
      error: error.message,
    });
  }
};

export const getMyProductReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id || req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const review = await Review.findOne({
      product: productId,
      user: userId,
    });

    return res.status(200).json({
      success: true,
      review,
      hasReviewed: !!review,
    });
  } catch (error) {
    console.error("Get customer review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your review",
    });
  }
};

// Update own review
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id || req.user._id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this review",
      });
    }

    if (rating !== undefined) {
      if (
        !Number.isInteger(Number(rating)) ||
        Number(rating) < 1 ||
        Number(rating) > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Rating must be an integer between 1 and 5",
        });
      }

      review.rating = Number(rating);
    }

    if (comment !== undefined) {
      if (typeof comment !== "string" || comment.trim().length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Comment must be a string with a maximum of 1000 characters",
        });
      }

      review.comment = comment.trim();
    }

    review.isApproved = false;

    await review.save();
    await review.populate("user", "firstName lastName image");

    return res.status(200).json({
      success: true,
      message: "Review updated and submitted for approval",
      review,
    });
  } catch (error) {
    console.error("Update review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update review",
      error: error.message,
    });
  }
};

// Delete own review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id || req.user._id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this review",
      });
    }

    await Review.findByIdAndDelete(reviewId);

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: error.message,
    });
  }
};

// Admin: Get all reviews
export const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("user", "firstName lastName email image")
      .populate("product", "name images price")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      totalReviews: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error("Get all reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve reviews",
      error: error.message,
    });
  }
};

// Admin: Approve or reject a review
export const updateReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { isApproved } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    if (typeof isApproved !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isApproved must be true or false",
      });
    }

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { isApproved },
      { new: true, runValidators: true },
    )
      .populate("user", "firstName lastName email image")
      .populate("product", "name images price");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: isApproved
        ? "Review approved successfully"
        : "Review rejected successfully",
      review,
    });
  } catch (error) {
    console.error("Update review status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update review status",
      error: error.message,
    });
  }
};

// Public: best recent reviews
export const getFeaturedReviews = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 12);

    const [reviews, stats] = await Promise.all([
      Review.find({ isApproved: true, rating: { $gte: 4 } })
        .sort({ createdAt: -1 })
        .limit(limit * 3)
        .populate("user", "firstName lastName")
        .populate({
          path: "product",
          select: "name",
          match: { isActive: true },
        })
        .lean(),
      Review.aggregate([
        { $match: { isApproved: true } },
        {
          $group: {
            _id: null,
            average: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const items = reviews
      .filter((review) => review.user && review.product)
      .slice(0, limit)
      .map((review) => ({
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        author: displayName(review.user),
        product: { _id: review.product._id, name: review.product.name },
      }));

    const summary = stats[0]
      ? { average: Number(stats[0].average.toFixed(1)), count: stats[0].count }
      : { average: 0, count: 0 };

    return res.status(200).json({ success: true, reviews: items, summary });
  } catch (error) {
    console.error("Get featured reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve reviews",
    });
  }
};

// Admin: Delete any review
export const adminDeleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findByIdAndDelete(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: error.message,
    });
  }
};

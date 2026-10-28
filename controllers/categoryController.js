import mongoose from "mongoose";
import Category from "../models/category.js";
import Product from "../models/product.js";

const EDITABLE = ["name", "description", "image"];

const pick = (obj, keys) =>
  Object.fromEntries(
    keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]])
  );

const handleError = (res, error) => {
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors).map((e) => e.message).join(" ");
    return res.status(400).json({ message });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: `Invalid value for ${error.path}.` });
  }
  if (error.code === 11000) {
    return res
      .status(409)
      .json({ message: "A category with this name already exists." });
  }
  console.error(error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};

const notFound = (res) =>
  res.status(404).json({ message: "Category not found." });

// GET /api/categories  (public)
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    const counts = await Product.aggregate([
      {
        $match: {
          isActive: true,
          category: { $in: categories.map((c) => c._id) },
        },
      },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json({
      categories: categories.map((c) => ({
        ...c,
        productCount: countMap.get(String(c._id)) || 0,
      })),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/categories/admin/all
export const getAdminCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ categories });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/categories/:id  (public)
export const getCategoryById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const category = await Category.findById(req.params.id);
    if (!category || !category.isActive) return notFound(res);

    res.json(category);
  } catch (error) {
    handleError(res, error);
  }
};

// POST /api/categories  (admin)
export const createCategory = async (req, res) => {
  try {
    const category = await Category.create(pick(req.body, EDITABLE));
    res.status(201).json(category);
  } catch (error) {
    handleError(res, error);
  }
};

// PUT /api/categories/:id  (admin)
export const updateCategory = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const category = await Category.findById(req.params.id);
    if (!category) return notFound(res);

    category.set(pick(req.body, EDITABLE));
    await category.save(); 

    res.json(category);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/categories/:id/status  (admin)
export const setCategoryStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be true or false." });
    }

    const category = await Category.findById(req.params.id);
    if (!category) return notFound(res);

    category.isActive = req.body.isActive;
    await category.save();

    res.json(category);
  } catch (error) {
    handleError(res, error);
  }
};
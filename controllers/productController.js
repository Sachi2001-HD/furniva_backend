import mongoose from "mongoose";
import Product from "../models/product.js";
import Category from "../models/category.js";

const EDITABLE = [
  "name", "description", "category", "material", "colour",
  "price", "offerPrice", "dimensions", "images", "stock",
  "badge", "isFeatured",
];

const SORTS = {
  newest: { createdAt: -1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  rating: { rating: -1, reviewCount: -1 },
};

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
  console.error(error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};

const notFound = (res) =>
  res.status(404).json({ message: "Product not found." });

const categoryExists = async (id) =>
  mongoose.isValidObjectId(id) && (await Category.exists({ _id: id }));

// GET products
export const getProducts = async (req, res) => {
  try {
    const {
      search, category, material, minPrice, maxPrice,
      inStock, featured, sort, page = 1, limit = 12,
    } = req.query;

    const filter = { isActive: true };

    if (search) filter.$text = { $search: search };
    if (category) {
      const ids = category.split(",").filter(mongoose.isValidObjectId);
      filter.category = { $in: ids };
    }
    if (material) filter.material = { $in: material.split(",") };
    if (inStock === "true") filter.stock = { $gt: 0 };
    if (featured === "true") filter.isFeatured = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);

    let query = Product.find(filter).populate("category", "name");

    // Sort by text score if searching and no sort is specified
    if (search && !sort) {
      query = query
        .select({ score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } });
    } else {
      query = query.sort(SORTS[sort] || SORTS.newest);
    }

    const [products, total] = await Promise.all([
      query.skip((pageNum - 1) * limitNum).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.json({
      products,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/products/admin/all
export const getAdminProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name")
      .sort({ createdAt: -1 });
    res.json({ products });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/products/:id  (public)
export const getProductById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const product = await Product.findById(req.params.id).populate(
      "category",
      "name"
    );
    if (!product || !product.isActive) return notFound(res);

    res.json(product);
  } catch (error) {
    handleError(res, error);
  }
};

// POST /api/products  (admin)
export const createProduct = async (req, res) => {
  try {
    const data = pick(req.body, EDITABLE);

    if (!(await categoryExists(data.category))) {
      return res.status(400).json({ message: "Choose a valid category." });
    }

    const product = await Product.create(data);
    res.status(201).json(product);
  } catch (error) {
    handleError(res, error);
  }
};

// PUT /api/products/:id  (admin)
export const updateProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const product = await Product.findById(req.params.id);
    if (!product) return notFound(res);

    const data = pick(req.body, EDITABLE);

    if (data.category && !(await categoryExists(data.category))) {
      return res.status(400).json({ message: "Choose a valid category." });
    }

    product.set(data);
    await product.save(); 

    res.json(product);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/products/:id/status  (admin) 
export const setProductStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be true or false." });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return notFound(res);

    product.isActive = req.body.isActive;
    await product.save();

    res.json(product);
  } catch (error) {
    handleError(res, error);
  }
};
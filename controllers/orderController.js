import mongoose from "mongoose";

import Order, { ORDER_STATUSES } from "../models/order.js";
import Product from "../models/product.js";
import { calculateDeliveryFee } from "../utils/deliveryFee.js";

import {
  cancelPaymentForOrder,
  ensurePayment,
  settleCodPayment,
} from "./paymentController.js";

const MAX_QUANTITY = 20;
const PAYMENT_METHODS = ["cod", "bank_transfer"];

const ADDRESS_FIELDS = [
  "fullName",
  "phone",
  "address",
  "city",
  "postalCode",
];

const TRANSITIONS = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

const pick = (obj, keys) => {
  const source = obj ?? {};

  return Object.fromEntries(
    keys
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]])
  );
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const handleError = (res, error) => {
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((e) => e.message)
      .join(" ");

    return res.status(400).json({ message });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      message: `Invalid value for ${error.path}.`,
    });
  }

  console.error(error);

  return res.status(500).json({
    message: "Something went wrong. Please try again.",
  });
};

const notFound = (res) =>
  res.status(404).json({ message: "Order not found." });

const logFailure = (promise) =>
  promise.catch((error) =>
    console.error("Payment update failed:", error.message)
  );

const effectivePrice = (product) =>
  product.offerPrice != null && product.offerPrice < product.price
    ? product.offerPrice
    : product.price;

// Validate requested items and merge repeated products
const mergeRequestedItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Your order has no items." };
  }

  const requested = new Map();

  for (const item of items) {
    const quantity = Number(item?.quantity);

    if (
      !mongoose.isValidObjectId(item?.product) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return {
        error: `Each item needs a valid product and a quantity between 1 and ${MAX_QUANTITY}.`,
      };
    }

    const key = String(item.product);
    const newQuantity = (requested.get(key) || 0) + quantity;

    if (newQuantity > MAX_QUANTITY) {
      return {
        error: `The maximum quantity for one product is ${MAX_QUANTITY}.`,
      };
    }

    requested.set(key, newQuantity);
  }

  return { requested };
};

// Restore product stock
const restoreStock = (items) =>
  items.length
    ? Product.bulkWrite(
        items.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: item.quantity } },
          },
        }))
      )
    : Promise.resolve();

// Move an order to a new status
const moveOrder = async (order, nextStatus, actorId = null) => {
  const update = { status: nextStatus };
  const isCod = order.paymentMethod === "cod";

  if (nextStatus === "Delivered") {
    update.deliveredAt = new Date();

    if (isCod) {
      update.paymentStatus = "paid";
    }
  }

  if (nextStatus === "Cancelled") {
    update.cancelledAt = new Date();
  }

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: order.status,
    },
    update,
    { new: true }
  );

  if (updated && nextStatus === "Cancelled") {
    await restoreStock(order.items);

    await logFailure(
      cancelPaymentForOrder(order._id, actorId)
    );
  }

  if (updated && nextStatus === "Delivered" && isCod) {
    await logFailure(
      settleCodPayment(updated, actorId)
    );
  }

  return updated;
};

export const quoteOrder = async (req, res) => {
  try {
    const body = req.body ?? {};

    const { requested, error } = mergeRequestedItems(body.items);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const products = await Product.find({
      _id: { $in: [...requested.keys()] },
      isActive: true,
    }).select("price offerPrice");

    if (products.length !== requested.size) {
      return res.status(400).json({
        message: "One or more products are no longer available.",
      });
    }

    const itemsTotal = products.reduce(
      (sum, product) =>
        sum +
        effectivePrice(product) *
          requested.get(String(product._id)),
      0
    );

    const deliveryFee = calculateDeliveryFee({
      subtotal: itemsTotal,
      city: body.shippingAddress?.city,
    });

    res.json({
      subtotal: itemsTotal,
      deliveryFee,
      total: itemsTotal + deliveryFee,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /orders
export const createOrder = async (req, res) => {
  try {
    const body = req.body ?? {};

    const { requested, error } = mergeRequestedItems(body.items);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const paymentMethod = body.paymentMethod ?? "cod";

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        message: "Choose a valid payment method.",
      });
    }

    const products = await Product.find({
      _id: { $in: [...requested.keys()] },
      isActive: true,
    });

    if (products.length !== requested.size) {
      return res.status(400).json({
        message: "One or more products are no longer available.",
      });
    }

    // Check stock availability
    for (const product of products) {
      const quantity = requested.get(String(product._id));

      if (product.stock < quantity) {
        return res.status(409).json({
          message:
            product.stock === 0
              ? `"${product.name}" is out of stock.`
              : `Only ${product.stock} of "${product.name}" left in stock.`,
        });
      }
    }

    // Prepare order items using current product prices
    const items = products.map((product) => ({
      product: product._id,
      name: product.name,
      image: product.images[0],
      price: effectivePrice(product),
      quantity: requested.get(String(product._id)),
    }));

    const itemsTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const deliveryCharge = calculateDeliveryFee({
      subtotal: itemsTotal,
      city: body.shippingAddress?.city,
    });

    const order = new Order({
      user: req.user._id,
      items,
      shippingAddress: pick(
        body.shippingAddress,
        ADDRESS_FIELDS
      ),
      note: body.note,
      paymentMethod,
      itemsTotal,
      deliveryCharge,
      total: itemsTotal + deliveryCharge,
    });

    await order.validate();

    // Reserve product stock
    const taken = [];

    for (const item of items) {
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.product,
          isActive: true,
          stock: { $gte: item.quantity },
        },
        {
          $inc: { stock: -item.quantity },
        }
      );

      if (!updated) {
        await restoreStock(taken);

        return res.status(409).json({
          message: `"${item.name}" just sold out. Please update your cart.`,
        });
      }

      taken.push(item);
    }

    // Save order. Restore stock if saving fails.
    try {
      await order.save();
    } catch (error) {
      await restoreStock(taken);
      throw error;
    }

    // Create the payment record for the new order.
    await logFailure(ensurePayment(order));

    res.status(201).json(order);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /orders/my
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
    }).sort({
      createdAt: -1,
    });

    res.json({ orders });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /orders/:id
export const getOrderById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return notFound(res);
    }

    const order = await Order.findById(req.params.id).populate(
      "user",
      "firstName lastName email contactNumber"
    );

    if (!order) return notFound(res);

    const isOwner =
      String(order.user?._id) === String(req.user._id);

    if (!isOwner && req.user.role !== "admin") {
      return notFound(res);
    }

    res.json(order);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /orders/:id/cancel
export const cancelMyOrder = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return notFound(res);
    }

    const order = await Order.findById(req.params.id);

    if (
      !order ||
      String(order.user) !== String(req.user._id)
    ) {
      return notFound(res);
    }

    if (order.status !== "Pending") {
      return res.status(400).json({
        message:
          "Only pending orders can be cancelled. Please contact us.",
      });
    }

    const updated = await moveOrder(
      order,
      "Cancelled",
      req.user._id
    );

    if (!updated) {
      return res.status(409).json({
        message: "This order was just updated. Please refresh.",
      });
    }

    res.json(updated);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /orders (admin)
export const getAllOrders = async (req, res) => {
  try {
    const {
      status,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid status.",
        });
      }

      filter.status = status;
    }

    if (search) {
      filter.orderNumber = new RegExp(
        escapeRegex(search),
        "i"
      );
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),

      Order.countDocuments(filter),
    ]);

    res.json({
      orders,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /orders/:id/status (admin)
export const updateOrderStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return notFound(res);
    }

    const status = req.body?.status;

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Status must be one of: ${ORDER_STATUSES.join(", ")}.`,
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) return notFound(res);

    if (!TRANSITIONS[order.status]?.includes(status)) {
      return res.status(400).json({
        message: `An order that is ${order.status} cannot be changed to ${status}.`,
      });
    }

    const updated = await moveOrder(
      order,
      status,
      req.user._id
    );

    if (!updated) {
      return res.status(409).json({
        message: "This order was just updated. Please refresh.",
      });
    }

    res.json(updated);
  } catch (error) {
    handleError(res, error);
  }
};

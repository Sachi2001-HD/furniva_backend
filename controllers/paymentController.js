import mongoose from "mongoose";
import Payment, {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "../models/payment.js";
import Order from "../models/order.js";

const TRANSITIONS = {
  pending: ["paid", "cancelled"],
  submitted: ["paid", "rejected", "cancelled"],
  rejected: ["paid", "cancelled"],
  paid: ["refunded"],
  refunded: [],
  cancelled: [],
};

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

const notFound = (res, text = "Payment not found.") =>
  res.status(404).json({ message: text });

export const normaliseMethod = (value = "") => {
  const key = String(value).toLowerCase().replace(/[\s_-]/g, "");

  if (["cod", "cashondelivery"].includes(key)) return "cod";
  if (["banktransfer", "bank"].includes(key)) return "bank_transfer";

  return "other";
};

const orderAmount = (order) => {
  const total = order.total ?? order.totalPrice ?? order.totalAmount;

  if (total != null) return Number(total);

  return (order.items ?? order.orderItems ?? []).reduce(
    (sum, item) =>
      sum +
      Number(item.price ?? 0) *
        Number(item.quantity ?? item.qty ?? 1),
    0
  );
};

const isOwnCloudinaryUrl = (value) => {
  try {
    const url = new URL(value);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      (!cloud || url.pathname.startsWith(`/${cloud}/`))
    );
  } catch {
    return false;
  }
};

// Synchronize payment information with the order
const syncOrder = async (payment) => {
  const has = (name) => !!Order.schema.path(name);
  const paid = payment.status === "paid";

  const fields = {};

  if (has("paymentStatus")) {
    fields.paymentStatus = payment.status;
  }

  if (has("isPaid")) {
    fields.isPaid = paid;
  }

  if (has("paidAt")) {
    fields.paidAt = paid ? payment.paidAt : null;
  }

  if (Object.keys(fields).length > 0) {
    await Order.updateOne(
      { _id: payment.order },
      { $set: fields }
    );
  }
};

// Create a payment record if it doesn't exist
export const ensurePayment = async (order) => {
  const existing = await Payment.findOne({ order: order._id });

  if (existing) return existing;

  try {
    return await Payment.create({
      order: order._id,
      user: order.user,
      method: normaliseMethod(order.paymentMethod),
      amount: orderAmount(order),
      history: [
        {
          status: "pending",
          note: "Payment created",
        },
      ],
    });
  } catch (error) {
    if (error.code === 11000) {
      return Payment.findOne({ order: order._id });
    }

    throw error;
  }
};

// Cancel payment when the associated order is cancelled
export const cancelPaymentForOrder = async (orderId, actorId = null) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new Error("Invalid order ID.");
  }

  const payment = await Payment.findOne({ order: orderId });

  if (!payment) return null;

  if (["paid", "refunded"].includes(payment.status)) {
    throw new Error(
      `Cannot cancel an order with a ${payment.status} payment.`
    );
  }

  if (payment.status === "cancelled") return payment;

  if (!TRANSITIONS[payment.status]?.includes("cancelled")) {
    throw new Error(
      `Cannot cancel a payment with status ${payment.status}.`
    );
  }

  payment.status = "cancelled";
  payment.adminNote = "Order cancelled.";

  payment.history.push({
    status: "cancelled",
    by: actorId || undefined,
    note: "Payment cancelled because the order was cancelled.",
  });

  await payment.save();
  await syncOrder(payment);

  return payment;
};

// Mark COD payment as paid when the order is delivered
export const settleCodPayment = async (order, actorId = null) => {
  const payment = await ensurePayment(order);

  if (!payment) return null;

  if (payment.method !== "cod") {
    return payment;
  }

  if (payment.status === "paid") {
    return payment;
  }

  if (!["pending", "rejected"].includes(payment.status)) {
    throw new Error(
      `Cannot settle a COD payment with status ${payment.status}.`
    );
  }

  if (!TRANSITIONS[payment.status]?.includes("paid")) {
    throw new Error(
      `A ${payment.status} payment cannot be marked as paid.`
    );
  }

  payment.status = "paid";
  payment.paidAt = new Date();

  payment.history.push({
    status: "paid",
    ...(actorId ? { by: actorId } : {}),
    note: "Cash on delivery payment collected.",
  });

  await payment.save();
  await syncOrder(payment);

  return payment;
};

// Find order and check access permissions
const findOrder = async (req, res, { ownerOnly = false } = {}) => {
  const { orderId } = req.params;

  if (!mongoose.isValidObjectId(orderId)) {
    notFound(res, "Order not found.");
    return null;
  }

  const order = await Order.findById(orderId);

  const isOwner =
    !!order &&
    String(order.user?._id ?? order.user) === String(req.user._id);

  const isAdmin = req.user.role === "admin";

  if (!order || !(isOwner || (isAdmin && !ownerOnly))) {
    notFound(res, "Order not found.");
    return null;
  }

  return order;
};

// GET /payments/order/:orderId
export const getOrderPayment = async (req, res) => {
  try {
    const order = await findOrder(req, res);

    if (!order) return;

    res.json(await ensurePayment(order));
  } catch (error) {
    handleError(res, error);
  }
};

// POST /payments/order/:orderId/receipt
export const submitReceipt = async (req, res) => {
  try {
    const { receiptUrl, reference, note } = req.body;

    if (!receiptUrl || !isOwnCloudinaryUrl(receiptUrl)) {
      return res.status(400).json({
        message: "Please upload an image of your payment slip.",
      });
    }

    const order = await findOrder(req, res, {
      ownerOnly: true,
    });

    if (!order) return;

    const payment = await ensurePayment(order);

    if (payment.method !== "bank_transfer") {
      return res.status(400).json({
        message: "A payment slip is only needed for bank transfers.",
      });
    }

    if (["paid", "refunded"].includes(payment.status)) {
      return res.status(400).json({
        message: `This payment is already ${payment.status}.`,
      });
    }

    // Allow a customer to upload a new receipt after rejection.
    if (["paid", "refunded", "cancelled"].includes(payment.status)) {
      return res.status(400).json({
        message: `This payment is already ${payment.status}.`,
      });
    }

    payment.receiptUrl = receiptUrl;
    payment.reference = reference?.trim() || payment.reference;
    payment.customerNote = note?.trim() || undefined;
    payment.status = "submitted";
    payment.submittedAt = new Date();

    payment.history.push({
      status: "submitted",
      by: req.user._id,
      note:
        "Payment slip uploaded" +
        (payment.receiptUrl ? " or updated" : ""),
    });

    await payment.save();
    await syncOrder(payment);

    res.json(payment);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /payments (admin)
export const listPayments = async (req, res) => {
  try {
    const {
      status,
      method,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (PAYMENT_STATUSES.includes(status)) {
      filter.status = status;
    }

    if (PAYMENT_METHODS.includes(method)) {
      filter.method = method;
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("user", "firstName lastName email")
        .populate("order", "createdAt orderNumber")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),

      Payment.countDocuments(filter),
    ]);

    res.json({
      payments,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /payments/:id (admin)
export const getPaymentById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return notFound(res);
    }

    const payment = await Payment.findById(req.params.id)
      .populate("user", "firstName lastName email")
      .populate("order", "createdAt orderNumber")
      .populate("history.by", "firstName lastName");

    if (!payment) return notFound(res);

    res.json(payment);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /payments/:id/status (admin)
export const updatePaymentStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return notFound(res);
    }

    const { status, note } = req.body;

    if (!PAYMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Choose a valid payment status.",
      });
    }

    const payment = await Payment.findById(req.params.id);

    if (!payment) return notFound(res);

    if (!TRANSITIONS[payment.status]?.includes(status)) {
      return res.status(400).json({
        message: `A ${payment.status} payment can't be changed to ${status}.`,
      });
    }

    if (status === "rejected" && !note?.trim()) {
      return res.status(400).json({
        message: "Add a reason so the customer knows what to fix.",
      });
    }

    payment.status = status;
    payment.adminNote = note?.trim() || undefined;

    if (status === "paid") {
      payment.paidAt = new Date();
      payment.verifiedBy = req.user._id;
    }

    if (status === "refunded") {
      payment.refundedAt = new Date();
    }

    payment.history.push({
      status,
      by: req.user._id,
      note: note?.trim() || undefined,
    });

    await payment.save();
    await syncOrder(payment);

    res.json(payment);
  } catch (error) {
    handleError(res, error);
  }
};

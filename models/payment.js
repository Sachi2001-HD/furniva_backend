import mongoose from "mongoose";

export const PAYMENT_METHODS = ["cod", "bank_transfer", "other"];

export const PAYMENT_STATUSES = [
  "pending",
  "submitted",
  "paid",
  "rejected",
  "refunded",
  "cancelled",
];

const historySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "LKR",
    },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },

    reference: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    receiptUrl: {
      type: String,
      trim: true,
    },

    customerNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    adminNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    submittedAt: Date,
    paidAt: Date,
    refundedAt: Date,

    history: {
      type: [historySchema],
      default: [],
    },
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;

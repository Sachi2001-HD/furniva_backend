import mongoose from "mongoose";
import { reference } from "../utils/controllerHelpers.js";

export const CUSTOM_REQUEST_STATUSES = [
  "Submitted",
  "In review",
  "Quoted",
  "Accepted",
  "In production",
  "Completed",
  "Declined",
  "Cancelled",
];

const quoteSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 500 },
    validUntil: { type: Date },
    quotedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const size = { type: Number, required: true, min: 10, max: 500 };

const customRequestSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, default: () => reference("CR") },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // What the customer designed
    piece: { type: String, required: true, trim: true, maxlength: 60 },
    timber: { type: String, required: true, trim: true, maxlength: 60 },
    finish: { type: String, required: true, trim: true, maxlength: 60 },
    dimensions: { w: size, d: size, h: size }, // cm
    notes: { type: String, trim: true, maxlength: 1000 },

    contactName: { type: String, required: true, trim: true, maxlength: 100 },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Enter a valid email address"],
    },
    contactPhone: { type: String, trim: true, maxlength: 30 },

    status: {
      type: String,
      enum: CUSTOM_REQUEST_STATUSES,
      default: "Submitted",
    },

    quote: { type: quoteSchema, default: null },
    adminNote: { type: String, trim: true, maxlength: 500 },

    acceptedAt: Date,
    cancelledAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

customRequestSchema.index({ user: 1, createdAt: -1 });
customRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("CustomRequest", customRequestSchema);
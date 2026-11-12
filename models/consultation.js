import mongoose from "mongoose";
import { reference } from "../utils/controllerHelpers.js";

export const CONSULTATION_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];
export const CONSULTATION_MODES = ["video", "in-store", "undecided"];
export const SPACES = ["Living room", "Bedroom", "Dining room", "Home office", "Other"];
export const TIME_PREFERENCES = ["Any time", "Morning", "Afternoon", "Evening"];

const consultationSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, default: () => reference("CON") },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    name: { type: String, required: [true, "Enter your name."], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, "Enter your email address."],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Enter a valid email address."],
    },
    phone: { type: String, trim: true, maxlength: 30 },

    mode: {
      type: String,
      enum: { values: CONSULTATION_MODES, message: "Choose how you’d like to connect." },
      default: "video",
    },
    space: {
      type: String,
      enum: { values: SPACES, message: "Choose a space from the list." },
      default: SPACES[0],
    },
    budget: { type: String, trim: true, maxlength: 60 },

    preferredDate: { type: Date, default: null },
    preferredTime: {
      type: String,
      enum: { values: TIME_PREFERENCES, message: "Choose a time from the list." },
      default: "Any time",
    },

    message: {
      type: String,
      required: [true, "Tell us a little about your space."],
      trim: true,
      minlength: [10, "Tell us a little about your space (at least 10 characters)."],
      maxlength: 1000,
    },

    status: { type: String, enum: CONSULTATION_STATUSES, default: "Pending" },

    // Set by the team when they confirm
    scheduledAt: Date,
    meetingLink: { type: String, trim: true, maxlength: 300 },
    adminNote: { type: String, trim: true, maxlength: 500 },

    cancelledAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

consultationSchema.index({ user: 1, createdAt: -1 });
consultationSchema.index({ email: 1, status: 1 });
consultationSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Consultation", consultationSchema);
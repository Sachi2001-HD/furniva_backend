import mongoose from "mongoose";
import { reference } from "../utils/controllerHelpers.js";

export const CONSULTATION_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];
export const CONSULTATION_MODES = ["online", "phone"];
export const CONSULTATION_TOPICS = [
  "Room planning",
  "Choosing furniture",
  "A custom piece",
  "Something else",
];
export const TIME_WINDOWS = ["Morning", "Afternoon", "Evening"];
export const ROOM_TYPES = ["Living room", "Bedroom", "Dining room", "Office", "Whole home", "Other"];

const consultationSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, default: () => reference("CON") },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    mode: { type: String, enum: CONSULTATION_MODES, required: true },
    topic: { type: String, enum: CONSULTATION_TOPICS, required: true },
    roomType: { type: String, enum: [...ROOM_TYPES, ""], default: "" },

    // What the customer asked for: a day and a time window
    preferredDate: { type: Date, required: true },
    timeWindow: { type: String, enum: TIME_WINDOWS, required: true },

    phone: { type: String, required: true, trim: true, maxlength: 30 },
    budget: { type: String, trim: true, maxlength: 60 },
    message: { type: String, trim: true, maxlength: 1000 },

    status: { type: String, enum: CONSULTATION_STATUSES, default: "Pending" },

    scheduledAt: Date,
    meetingLink: { type: String, trim: true, maxlength: 300 },
    adminNote: { type: String, trim: true, maxlength: 500 },

    cancelledAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

consultationSchema.index({ user: 1, preferredDate: -1 });
consultationSchema.index({ status: 1, preferredDate: 1 });

export default mongoose.model("Consultation", consultationSchema);
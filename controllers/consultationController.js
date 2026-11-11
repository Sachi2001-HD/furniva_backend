import mongoose from "mongoose";
import Consultation, { CONSULTATION_STATUSES } from "../models/consultation.js";
import { escapeRegex, handleError, notFound, pick } from "../utils/controllerHelpers.js";

const EDITABLE = ["mode", "topic", "roomType", "preferredDate", "timeWindow", "phone", "budget", "message"];
const MAX_ACTIVE = 3;
const MAX_DAYS_AHEAD = 90;
const DAY = 24 * 60 * 60 * 1000;

const TRANSITIONS = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

const missing = (res) => notFound(res, "Consultation");

const findOwn = (req) =>
  mongoose.isValidObjectId(req.params.id)
    ? Consultation.findOne({ _id: req.params.id, user: req.user._id })
    : null;

// POST /consultations
export const createConsultation = async (req, res) => {
  try {
    const data = pick(req.body, EDITABLE);

    const date = new Date(data.preferredDate);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ message: "Choose a date for your consultation." });
    }

    const now = Date.now();
    if (date.getTime() < now - DAY || date.getTime() > now + MAX_DAYS_AHEAD * DAY) {
      return res.status(400).json({
        message: `Choose a date within the next ${MAX_DAYS_AHEAD} days.`,
      });
    }

    const active = await Consultation.countDocuments({
      user: req.user._id,
      status: { $in: ["Pending", "Confirmed"] },
    });
    if (active >= MAX_ACTIVE) {
      return res.status(400).json({
        message: `You already have ${MAX_ACTIVE} upcoming consultations. Cancel one or wait until one is finished.`,
      });
    }

    const consultation = await Consultation.create({
      ...data,
      preferredDate: date,
      user: req.user._id,
    });

    res.status(201).json(consultation);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /consultations/my
export const getMyConsultations = async (req, res) => {
  try {
    const consultations = await Consultation.find({ user: req.user._id }).sort({
      preferredDate: -1,
    });
    res.json({ consultations });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /consultations/:id/cancel
export const cancelMyConsultation = async (req, res) => {
  try {
    const consultation = await findOwn(req);
    if (!consultation) return missing(res);

    if (!["Pending", "Confirmed"].includes(consultation.status)) {
      return res.status(400).json({
        message: "This consultation can’t be cancelled any more.",
      });
    }

    consultation.status = "Cancelled";
    consultation.cancelledAt = new Date();
    await consultation.save();

    res.json(consultation);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /consultations  (admin)
export const getAllConsultations = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) {
      if (!CONSULTATION_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
      }
      filter.status = status;
    }
    if (search) filter.reference = new RegExp(escapeRegex(search), "i");

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const [consultations, total] = await Promise.all([
      Consultation.find(filter)
        .populate("user", "firstName lastName email")
        .sort({ preferredDate: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Consultation.countDocuments(filter),
    ]);

    res.json({ consultations, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /consultations/:id  (admin)
export const updateConsultation = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return missing(res);

    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) return missing(res);

    const { status, scheduledAt, meetingLink, adminNote } = req.body ?? {};

    if (adminNote !== undefined) consultation.adminNote = adminNote;

    if (meetingLink !== undefined) {
      if (meetingLink && !/^https:\/\/\S+$/i.test(meetingLink)) {
        return res.status(400).json({ message: "The meeting link must start with https://" });
      }
      consultation.meetingLink = meetingLink;
    }

    if (scheduledAt !== undefined) {
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ message: "Enter a valid date and time." });
      }
      consultation.scheduledAt = when;
    }

    if (status !== undefined && status !== consultation.status) {
      if (!CONSULTATION_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Choose a valid status." });
      }
      if (!TRANSITIONS[consultation.status].includes(status)) {
        return res.status(400).json({
          message: `A ${consultation.status} consultation can’t be changed to ${status}.`,
        });
      }
      if (status === "Confirmed" && !consultation.scheduledAt) {
        return res.status(400).json({ message: "Set the date and time before confirming." });
      }

      consultation.status = status;
      if (status === "Completed") consultation.completedAt = new Date();
      if (status === "Cancelled") consultation.cancelledAt = new Date();
    }

    await consultation.save();
    res.json(consultation);
  } catch (error) {
    handleError(res, error);
  }
};
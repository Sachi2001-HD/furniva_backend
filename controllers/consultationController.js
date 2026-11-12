import mongoose from "mongoose";
import Consultation, { CONSULTATION_STATUSES } from "../models/consultation.js";
import { sendEmail } from "../utils/sendEmail.js";
import { escapeRegex, handleError, notFound, pick } from "../utils/controllerHelpers.js";

const EDITABLE = ["name", "email", "phone", "mode", "space", "budget", "preferredTime", "message"];
const MAX_ACTIVE = 3;
const MAX_DAYS_AHEAD = 90;
const DAY = 24 * 60 * 60 * 1000;
const PHONE = /^[0-9+\s()-]{7,20}$/;

const TRANSITIONS = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

const missing = (res) => notFound(res, "Consultation");

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const findOwn = (req) =>
  mongoose.isValidObjectId(req.params.id)
    ? Consultation.findOne({ _id: req.params.id, user: req.user._id })
    : null;

// Tells the team a request arrived
const notifyTeam = (consultation) => {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return;

  sendEmail({
    to,
    subject: `New consultation request ${consultation.reference}`,
    html: `
      <p><strong>${esc(consultation.name)}</strong> (${esc(consultation.email)}${
        consultation.phone ? `, ${esc(consultation.phone)}` : ""
      }) asked for a ${esc(consultation.mode)} consultation about their ${esc(consultation.space)}.</p>
      <p>Budget: ${esc(consultation.budget || "not given")}</p>
      <p>${esc(consultation.message).replace(/\n/g, "<br>")}</p>`,
  }).catch((error) => console.error("Team notification failed:", error.message));
};

// POST /consultations
export const createConsultation = async (req, res) => {
  try {
    const data = pick(req.body, EDITABLE);

    if (data.phone && !PHONE.test(String(data.phone).trim())) {
      return res.status(400).json({ message: "Enter a valid phone number." });
    }

    // The date is optional
    let preferredDate = null;
    if (req.body?.preferredDate) {
      const date = new Date(req.body.preferredDate);
      const now = Date.now();

      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: "Choose a valid date." });
      }
      if (date.getTime() < now - DAY || date.getTime() > now + MAX_DAYS_AHEAD * DAY) {
        return res.status(400).json({
          message: `Choose a date within the next ${MAX_DAYS_AHEAD} days.`,
        });
      }
      preferredDate = date;
    }

    // Stops one person from piling up requests
    const email = String(data.email ?? "").trim().toLowerCase();
    const owners = [{ email }];
    if (req.user) owners.push({ user: req.user._id });

    const active = await Consultation.countDocuments({
      $or: owners,
      status: { $in: ["Pending", "Confirmed"] },
    });
    if (active >= MAX_ACTIVE) {
      return res.status(400).json({
        message: `You already have ${MAX_ACTIVE} consultation requests waiting. We’ll be in touch soon.`,
      });
    }

    const consultation = await Consultation.create({
      ...data,
      preferredDate,
      user: req.user?._id ?? null,
    });

    notifyTeam(consultation);

    res.status(201).json(consultation);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /consultations/my
export const getMyConsultations = async (req, res) => {
  try {
    const consultations = await Consultation.find({ user: req.user._id }).sort({
      createdAt: -1,
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
        .sort({ createdAt: -1 })
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
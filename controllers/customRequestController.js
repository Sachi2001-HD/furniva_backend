import mongoose from "mongoose";
import CustomRequest, { CUSTOM_REQUEST_STATUSES } from "../models/customRequest.js";
import { escapeRegex, handleError, notFound, pick } from "../utils/controllerHelpers.js";

const EDITABLE = ["piece", "timber", "finish", "notes", "contactName", "contactEmail", "contactPhone"];
const MAX_OPEN = 5;

// Requests a customer can still cancel
const OPEN = ["Submitted", "In review", "Quoted"];

// What an admin may change a request to
const ADMIN_TRANSITIONS = {
  Submitted: ["In review", "Declined"],
  "In review": ["Declined"],
  Quoted: ["Declined"],
  Accepted: ["In production"],
  "In production": ["Completed"],
};

const missing = (res) => notFound(res, "Request");

const findOwn = (req) =>
  mongoose.isValidObjectId(req.params.id)
    ? CustomRequest.findOne({ _id: req.params.id, user: req.user._id })
    : null;

// POST /custom-requests
export const createCustomRequest = async (req, res) => {
  try {
    const open = await CustomRequest.countDocuments({
      user: req.user._id,
      status: { $in: OPEN },
    });
    if (open >= MAX_OPEN) {
      return res.status(400).json({
        message: `You have ${MAX_OPEN} requests waiting already. Cancel one or wait for a reply before sending another.`,
      });
    }

    const request = await CustomRequest.create({
      ...pick(req.body, EDITABLE),
      dimensions: pick(req.body?.dimensions, ["w", "d", "h"]),
      user: req.user._id,
    });

    res.status(201).json(request);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /custom-requests/my
export const getMyCustomRequests = async (req, res) => {
  try {
    const requests = await CustomRequest.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({ requests });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /custom-requests/:id  (owner or admin)
export const getCustomRequestById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return missing(res);

    const request = await CustomRequest.findById(req.params.id).populate(
      "user",
      "firstName lastName email contactNumber"
    );
    if (!request) return missing(res);

    const isOwner = String(request.user?._id) === String(req.user._id);
    if (!isOwner && req.user.role !== "admin") return missing(res);

    res.json(request);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /custom-requests/:id/cancel
export const cancelMyRequest = async (req, res) => {
  try {
    const request = await findOwn(req);
    if (!request) return missing(res);

    if (!OPEN.includes(request.status)) {
      return res.status(400).json({
        message: "This request can’t be cancelled any more. Please contact us.",
      });
    }

    request.status = "Cancelled";
    request.cancelledAt = new Date();
    await request.save();

    res.json(request);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /custom-requests/:id/accept
export const acceptQuote = async (req, res) => {
  try {
    const request = await findOwn(req);
    if (!request) return missing(res);

    if (request.status !== "Quoted" || !request.quote) {
      return res.status(400).json({ message: "There’s no quote to accept." });
    }
    if (request.quote.validUntil && request.quote.validUntil < new Date()) {
      return res.status(400).json({
        message: "This quote has expired. Please contact us for a new one.",
      });
    }

    request.status = "Accepted";
    request.acceptedAt = new Date();
    await request.save();

    res.json(request);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /custom-requests  (admin)
export const getAllCustomRequests = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) {
      if (!CUSTOM_REQUEST_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
      }
      filter.status = status;
    }
    if (search) filter.reference = new RegExp(escapeRegex(search), "i");

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const [requests, total] = await Promise.all([
      CustomRequest.find(filter)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      CustomRequest.countDocuments(filter),
    ]);

    res.json({ requests, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /custom-requests/:id/status  (admin)
export const updateRequestStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return missing(res);

    const { status, adminNote } = req.body ?? {};
    const request = await CustomRequest.findById(req.params.id);
    if (!request) return missing(res);

    if (!ADMIN_TRANSITIONS[request.status]?.includes(status)) {
      return res.status(400).json({
        message: `A request that is ${request.status} can’t be changed to ${status}.`,
      });
    }

    request.status = status;
    if (adminNote !== undefined) request.adminNote = adminNote;
    if (status === "Completed") request.completedAt = new Date();

    await request.save();
    res.json(request);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /custom-requests/:id/quote  (admin) 
export const setQuote = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return missing(res);

    const { amount, note, validUntil } = req.body ?? {};
    const request = await CustomRequest.findById(req.params.id);
    if (!request) return missing(res);

    if (!["Submitted", "In review", "Quoted"].includes(request.status)) {
      return res.status(400).json({
        message: `A ${request.status} request can’t be quoted.`,
      });
    }
    if (!(Number(amount) > 0)) {
      return res.status(400).json({ message: "Enter the quote amount." });
    }

    let until;
    if (validUntil) {
      until = new Date(validUntil);
      if (Number.isNaN(until.getTime()) || until < new Date()) {
        return res.status(400).json({ message: "Choose a future date the quote is valid until." });
      }
    }

    request.quote = { amount: Number(amount), note, validUntil: until, quotedAt: new Date() };
    request.status = "Quoted";

    await request.save();
    res.json(request);
  } catch (error) {
    handleError(res, error);
  }
};
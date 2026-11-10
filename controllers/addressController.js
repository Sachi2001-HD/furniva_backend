import mongoose from "mongoose";
import Address from "../models/address.js";

const MAX_ADDRESSES = 10;
const EDITABLE = ["label", "fullName", "phone", "address", "city", "postalCode"];

const pick = (obj, keys) => {
  const source = obj ?? {};
  return Object.fromEntries(
    keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]])
  );
};

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
  res.status(404).json({ message: "Address not found." });

const findOwn = (req) =>
  mongoose.isValidObjectId(req.params.id)
    ? Address.findOne({ _id: req.params.id, user: req.user._id })
    : null;

const clearDefault = (userId) =>
  Address.updateMany({ user: userId, isDefault: true }, { isDefault: false });

// GET /addresses
export const getAddresses = async (req, res) => {
  try {
    // Default first, then the most recently changed
    const addresses = await Address.find({ user: req.user._id }).sort({
      isDefault: -1,
      updatedAt: -1,
    });
    res.json({ addresses });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /addresses
export const createAddress = async (req, res) => {
  try {
    const count = await Address.countDocuments({ user: req.user._id });
    if (count >= MAX_ADDRESSES) {
      return res.status(400).json({
        message: `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.`,
      });
    }

    const makeDefault = count === 0 || req.body?.isDefault === true;

    const address = new Address({
      ...pick(req.body, EDITABLE),
      user: req.user._id,
      isDefault: makeDefault,
    });

    await address.validate();

    if (makeDefault) await clearDefault(req.user._id);
    await address.save();

    res.status(201).json(address);
  } catch (error) {
    handleError(res, error);
  }
};

// PUT /addresses/:id
export const updateAddress = async (req, res) => {
  try {
    const address = await findOwn(req);
    if (!address) return notFound(res);

    address.set(pick(req.body, EDITABLE));
    await address.validate();

    if (req.body?.isDefault === true && !address.isDefault) {
      await clearDefault(req.user._id);
      address.isDefault = true;
    }

    await address.save();
    res.json(address);
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /addresses/:id/default
export const setDefaultAddress = async (req, res) => {
  try {
    const address = await findOwn(req);
    if (!address) return notFound(res);

    if (!address.isDefault) {
      await clearDefault(req.user._id);
      address.isDefault = true;
      await address.save();
    }

    res.json(address);
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /addresses/:id
export const deleteAddress = async (req, res) => {
  try {
    const address = await findOwn(req);
    if (!address) return notFound(res);

    const wasDefault = address.isDefault;
    await address.deleteOne();

    if (wasDefault) {
      const next = await Address.findOne({ user: req.user._id }).sort({
        updatedAt: -1,
      });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    res.json({ message: "Address deleted.", _id: address._id });
  } catch (error) {
    handleError(res, error);
  }
};
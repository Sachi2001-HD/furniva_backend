import mongoose from "mongoose";
import Address from "../models/address.js";

// Get logged-in user's ID
const getUserId = (req) => req.user.id || req.user._id;

// Get all addresses belonging to the logged-in user
export const getAddresses = async (req, res) => {
  try {
    const userId = getUserId(req);

    const addresses = await Address.find({ user: userId })
      .sort({ isDefault: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: addresses.length,
      addresses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve addresses",
      error: error.message,
    });
  }
};

// Add a new address
export const addAddress = async (req, res) => {
  try {
    const userId = getUserId(req);

    const {
      recipientName,
      contactNumber,
      label,
      addressLine1,
      addressLine2,
      city,
      district,
      province,
      postalCode,
      country,
      isDefault,
    } = req.body;

    // Validate required fields
    if (
      !recipientName ||
      !contactNumber ||
      !addressLine1 ||
      !city ||
      !district ||
      !province
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required address fields",
      });
    }

    // Check whether the user already has an address
    const existingAddress = await Address.findOne({ user: userId });

    // First address automatically becomes the default
    const shouldBeDefault = isDefault || !existingAddress;

    // If the new address is default, remove default status from others
    if (shouldBeDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = await Address.create({
      user: userId,
      recipientName,
      contactNumber,
      label,
      addressLine1,
      addressLine2,
      city,
      district,
      province,
      postalCode,
      country,
      isDefault: shouldBeDefault,
    });

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      address: newAddress,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add address",
      error: error.message,
    });
  }
};

// Update an existing address
export const updateAddress = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const allowedFields = [
      "recipientName",
      "contactNumber",
      "label",
      "addressLine1",
      "addressLine2",
      "city",
      "district",
      "province",
      "postalCode",
      "country",
    ];

    // Update only allowed fields
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        address[field] = req.body[field];
      }
    });

    // Handle default address selection
    if (req.body.isDefault === true) {
      await Address.updateMany(
        { user: userId, _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );

      address.isDefault = true;
    }

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: error.message,
    });
  }
};

// Set an address as the default address
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await Address.updateMany(
      { user: userId },
      { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();

    return res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      address,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to set default address",
      error: error.message,
    });
  }
};

// Delete an address
export const deleteAddress = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const address = await Address.findOneAndDelete({
      _id: addressId,
      user: userId,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If the deleted address was the default, select another address
    if (address.isDefault) {
      const nextAddress = await Address.findOne({ user: userId })
        .sort({ createdAt: -1 });

      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: error.message,
    });
  }
};
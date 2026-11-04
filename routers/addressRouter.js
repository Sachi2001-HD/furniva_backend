import express from "express";

import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/addressController.js";

import { authenticate } from "../middlewares/authenticate.js";

const addressRouter = express.Router();

// All address routes require authentication
addressRouter.use(authenticate);

// Get all saved addresses
addressRouter.get("/", getAddresses);

// Add a new address
addressRouter.post("/", addAddress);

// Update an address
addressRouter.put("/:addressId", updateAddress);

// Set an address as default
addressRouter.patch("/:addressId/default", setDefaultAddress);

// Delete an address
addressRouter.delete("/:addressId", deleteAddress);

export default addressRouter;
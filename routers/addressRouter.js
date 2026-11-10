import express from "express";
import {
  getAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "../controllers/addressController.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getAddresses);
router.post("/", createAddress);
router.put("/:id", updateAddress);
router.patch("/:id/default", setDefaultAddress);
router.delete("/:id", deleteAddress);

export default router;
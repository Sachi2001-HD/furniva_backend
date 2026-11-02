import express from "express";
import upload from "../middlewares/upload.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const uploadRouter = express.Router();

uploadRouter.post("/images", authenticate, adminOnly, upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files?.length)
      return res.status(400).json({ message: "No images uploaded" });

    const results = await Promise.all(
      req.files.map((f) => uploadToCloudinary(f.buffer))
    );

    res.json({ urls: results.map((r) => r.secure_url) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default uploadRouter;
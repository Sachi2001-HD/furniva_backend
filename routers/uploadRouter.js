import express from "express";
import upload, { uploadModel } from "../middlewares/upload.js";
import {
  uploadToCloudinary,
  uploadModelToCloudinary,
} from "../utils/uploadToCloudinary.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const uploadRouter = express.Router();

const handleUpload = (middleware, maxMb) => (req, res, next) =>
  middleware(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? `File is too large (max ${maxMb} MB).`
        : error.message;
    res.status(400).json({ message });
  });

// Images (admin only)
uploadRouter.post(
  "/images",
  authenticate,
  adminOnly,
  handleUpload(upload.array("images", 5), 5),
  async (req, res) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({ message: "No images uploaded" });
      }

      const results = await Promise.all(
        req.files.map((f) => uploadToCloudinary(f.buffer))
      );

      res.json({ urls: results.map((r) => r.secure_url) });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 3D model (admin only)
uploadRouter.post(
  "/model",
  authenticate,
  adminOnly,
  handleUpload(uploadModel.single("model"), 10),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No 3D model uploaded" });
      }

      const result = await uploadModelToCloudinary(
        req.file.buffer,
        req.file.originalname
      );

      res.json({ url: result.secure_url });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default uploadRouter;
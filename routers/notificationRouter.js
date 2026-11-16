import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
} from "../controllers/notificationController.js";
import { authenticate } from "../middlewares/authenticate.js";

const notificationRouter = express.Router();

notificationRouter.use(authenticate);

notificationRouter.get("/", getNotifications);
notificationRouter.patch("/read-all", markAllAsRead);
notificationRouter.patch("/:id/read", markAsRead);
notificationRouter.delete("/:id", deleteNotification);
notificationRouter.delete("/", clearNotifications);

export default notificationRouter;

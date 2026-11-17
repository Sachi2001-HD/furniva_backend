import Notification from "../models/notification.js";
import { handleError } from "../utils/controllerHelpers.js";

// GET /notifications
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const notifications = await Notification.find({
      recipient: userId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: userId,
      },
      { isRead: true },
      { returnDocument: "after" }
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    res.json({
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    await Notification.updateMany(
      {
        recipient: userId,
        isRead: false,
      },
      { isRead: true }
    );

    res.json({
      message: "All notifications marked as read.",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /notifications/:id
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    res.json({
      message: "Notification deleted.",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /notifications
export const clearNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    await Notification.deleteMany({
      recipient: userId,
    });

    res.json({
      message: "All notifications cleared.",
    });
  } catch (error) {
    handleError(res, error);
  }
};

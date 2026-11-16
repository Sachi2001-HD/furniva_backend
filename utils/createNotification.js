import Notification from "../models/notification.js";

export const createNotification = async ({
  recipient,
  title,
  message,
  type = "system",
  link = null,
}) => {
  if (!recipient || !title || !message) {
    throw new Error("Recipient, title and message are required.");
  }

  return Notification.create({
    recipient,
    title,
    message,
    type,
    link,
  });
};

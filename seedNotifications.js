import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns";

import User from "./models/user.js";
import Notification from "./models/notification.js";

dotenv.config();

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const email = process.argv[2];

if (!email) {
  console.log("Usage: node seedNotifications.js user@example.com");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("Connected to MongoDB successfully");

  const user = await User.findOne({
    email: email.toLowerCase(),
  });

  if (!user) {
    console.log("User not found");
    process.exitCode = 1;
  } else {
    const ago = (minutes) =>
      new Date(Date.now() - minutes * 60000);

    const customerSamples = [
      {
        type: "order",
        title: "Order placed",
        message: "Your order ORD1025 has been received.",
        link: "/orders",
        isRead: false,
        createdAt: ago(5),
      },
      {
        type: "order",
        title: "Order shipped",
        message: "ORD1024 is on its way to you.",
        link: "/orders",
        isRead: false,
        createdAt: ago(120),
      },
      {
        type: "payment",
        title: "Payment received",
        message: "We have received your payment for ORD1023.",
        link: "/orders",
        isRead: true,
        createdAt: ago(1500),
      },
      {
        type: "consultation",
        title: "Consultation confirmed",
        message: "Your video call is booked for Friday at 10:00 AM.",
        link: "/consultation",
        isRead: false,
        createdAt: ago(4000),
      },
      {
        type: "custom_request",
        title: "Design request update",
        message: "Your custom dining table request is now in progress.",
        link: "/custom-furniture",
        isRead: true,
        createdAt: ago(7200),
      },
      {
        type: "system",
        title: "Welcome to Furniva",
        message: "Save favourites and track your orders from your account.",
        link: null,
        isRead: true,
        createdAt: ago(14400),
      },
    ];

    const adminSamples = [
      {
        type: "order",
        title: "New order",
        message: "N. Perera placed order ORD1025.",
        link: "/admin/orders",
        isRead: false,
        createdAt: ago(5),
      },
      {
        type: "system",
        title: "Low stock",
        message: "Galle Queen Bed has 3 left.",
        link: "/admin/products",
        isRead: false,
        createdAt: ago(60),
      },
      {
        type: "consultation",
        title: "New consultation request",
        message: "S. Fernando asked for a video consultation.",
        link: "/admin/requests",
        isRead: false,
        createdAt: ago(180),
      },
      {
        type: "payment",
        title: "Payment received",
        message: "ORD1023 has been paid.",
        link: "/admin/orders",
        isRead: true,
        createdAt: ago(1500),
      },
      {
        type: "custom_request",
        title: "New custom request",
        message: "M. Perera asked for a custom walnut bookcase.",
        link: "/admin/requests",
        isRead: true,
        createdAt: ago(4000),
      },
      {
        type: "system",
        title: "New review",
        message: "K. Fernando left a 5-star review.",
        link: "/admin/reviews",
        isRead: true,
        createdAt: ago(5000),
      },
    ];

    const samples =
      user.role === "admin" ? adminSamples : customerSamples;

    await Notification.insertMany(
      samples.map((item) => ({
        ...item,
        recipient: user._id,
      }))
    );

    console.log(
      `Added ${samples.length} notifications for ${user.email} (${user.role})`
    );
  }
} catch (error) {
  console.error("Error seeding notifications:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
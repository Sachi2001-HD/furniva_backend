import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const optionalAuthenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const user = await User.findById(payload.id);
      if (user && !user.isBlocked) req.user = user;
    }
  } catch {
    // an invalid or expired token
  }

  next();
};
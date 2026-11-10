import crypto from "crypto";
import User from "../models/user.js";
import PasswordResetToken from "../models/passwordResetToken.js";
import { sendEmail } from "../utils/sendEmail.js";
import { passwordChangedEmail, passwordResetEmail } from "../utils/emailTemplates.js";
import { handleError } from "../utils/controllerHelpers.js";

const TOKEN_MINUTES = 30;
const MAX_REQUESTS_PER_HOUR = 5;

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const SAME_ANSWER = {
  message: "If an account exists for that email, we’ve sent a link to reset the password.",
};

const findValidToken = (token) =>
  typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
    ? PasswordResetToken.findOne({
        tokenHash: hash(token),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      })
    : null;

// POST /password/forgot   { email }
export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const user = await User.findOne({ email });

    if (user && !user.isBlocked) {
      const recent = await PasswordResetToken.countDocuments({
        user: user._id,
        createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) },
      });

      if (recent < MAX_REQUESTS_PER_HOUR) {
        const token = crypto.randomBytes(32).toString("hex");

        await PasswordResetToken.create({
          user: user._id,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60 * 1000),
        });

        const link = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${token}`;

        sendEmail({
          to: user.email,
          subject: "Reset your Furniva password",
          html: passwordResetEmail(user.firstName, link, TOKEN_MINUTES),
        }).catch((error) => console.error("Reset email failed:", error.message));
      }
    }

    res.json(SAME_ANSWER);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /password/validate?token=...
export const validateResetToken = async (req, res) => {
  try {
    res.json({ valid: !!(await findValidToken(req.query.token)) });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /password/reset   { token, password }
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body ?? {};

    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res
        .status(400)
        .json({ message: "Use a password between 8 and 128 characters." });
    }

    const invalid = {
      message: "This reset link is invalid or has expired. Please request a new one.",
    };

    const record = await findValidToken(token);
    if (!record) return res.status(400).json(invalid);

    const user = await User.findById(record.user);
    if (!user || user.isBlocked) return res.status(400).json(invalid);

    user.password = password; 
    await user.save();

    // Every outstanding link for the account stops working
    await PasswordResetToken.deleteMany({ user: user._id });

    sendEmail({
      to: user.email,
      subject: "Your Furniva password was changed",
      html: passwordChangedEmail(user.firstName),
    }).catch((error) => console.error("Password email failed:", error.message));

    res.json({ message: "Your password has been updated. You can now sign in." });
  } catch (error) {
    handleError(res, error);
  }
};
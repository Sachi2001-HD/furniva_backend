import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/user.js";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
dotenv.config();

const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  return obj;
};

// User registration
export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "Please fill in all required fields" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
    });

    res.status(201).json({
      message: "Registration successful",
      token: generateToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

// User login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    // Google-only accounts have no password hash
    const isMatch = user?.password && (await bcrypt.compare(password, user.password));

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    res.json({
      message: "Login successful",
      token: generateToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// Google sign-in
export const googleLogin = async (req, res) => {
  try {
    const code = req.body?.code;
    if (!code) {
      return res
        .status(400)
        .json({ message: "Google sign-in failed. Please try again." });
    }

    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "postmessage"
    );

    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();

    if (!profile?.email || !profile.email_verified) {
      return res
        .status(400)
        .json({ message: "Your Google email address is not verified." });
    }

    let user = await User.findOne({ email: profile.email.toLowerCase() });

    if (!user) {
      user = await User.create({
        firstName: profile.given_name || profile.name || "Google",
        lastName: profile.family_name || "-",
        email: profile.email,
        googleId: profile.sub,
        image: profile.picture || null,
        isEmailVerified: true,
      });
    } else if (!user.googleId) {
      //Link the Google account to an existing user
      user.googleId = profile.sub;
      user.isEmailVerified = true;
      if (!user.image && profile.picture) user.image = profile.picture;
      await user.save();
    } else if (user.googleId !== profile.sub) {
      return res
        .status(401)
        .json({ message: "Google sign-in failed. Please try again." });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    res.json({
      message: "Login successful",
      token: generateToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Google login error:", error.message);
    res
      .status(401)
      .json({ message: "Google sign-in failed. Please try again." });
  }
};

// Profile retrieval
export const getMyProfile = async (req, res) => {
  res.json({ user: req.user });
};

// Profile update
export const updateMyProfile = async (req, res) => {
  try {
    const { firstName, lastName, contactNumber, image } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (contactNumber !== undefined) user.contactNumber = contactNumber;
    if (image !== undefined) user.image = image;

    await user.save();
    res.json({ message: "Profile updated", user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

// Password change
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Valid current and new passwords are required" });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user.password) {
      return res.status(400).json({
        message: "This account signs in with Google, so it has no password to change.",
      });
    }

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Password change failed", error: error.message });
  }
};
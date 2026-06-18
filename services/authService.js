const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Vendor = require("../models/Vendor");
const sendEmail = require("../services/emailService");
const notificationService = require("../services/notificationService");

const PASSWORD_RESET_TOKEN_TTL_MINUTES = 10;

const sanitizeUser = (user) => {
  const safeUser = user.toObject ? user.toObject() : { ...user };

  delete safeUser.password;
  delete safeUser.verificationToken;
  delete safeUser.verificationTokenExpires;
  delete safeUser.resetPasswordToken;
  delete safeUser.resetPasswordExpires;

  return {
    ...safeUser,
    id: safeUser._id,
  };
};

class AuthService {
  async registerUser(userData, protocol, host) {
    const { name, email, password, role, longitude, latitude } = userData;

    const userExists = await User.findOne({ email });
    if (userExists) throw new Error("User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const newUserData = {
      name,
      email,
      password: hashedPassword,
      role: role || "customer",
      verificationToken,
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000,
    };

    if (longitude !== undefined && latitude !== undefined) {
      newUserData.location = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
    }

    const user = await User.create(newUserData);

    if (user.role === "vendor") {
      await Vendor.create({
        user: user._id,
        businessName: `${user.name}'s Shop`,
        isVerified: false,
      });
    }

    const verifyUrl = `${protocol}://${host}/api/auth/verify-email/${verificationToken}`;
    const message = `Welcome to NextCart, ${name}!\n\nPlease verify your account by clicking the link below:\n\n${verifyUrl}`;

    try {
      await sendEmail({ email: user.email, subject: "Verify your Account", message });
    } catch (err) {
      // We don't throw here so the user is still registered even if email fails
      console.error("Email failed to send during registration");
    }

    return sanitizeUser(user);
  }

  async loginUser(email, password, io) {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Invalid credentials");

    if (!user.isVerified) throw new Error("Your account is not verified. Please check your email.");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await notificationService.sendSecurityAlert({ io, userEmail: user.email, userId: user._id });

    return { token, user: sanitizeUser(user) };
  }

  async verifyEmail(token, io) {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) throw new Error("Verification link is invalid or expired.");

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    await notificationService.createNotification({
      io,
      userId: user._id,
      title: "Account Verified! ✅",
      message: "Welcome to NextCart. Your account is now fully active.",
      type: "success"
    });

    return user;
  }

  async forgotPassword(email, protocol, host) {
    const user = await User.findOne({ email });
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000;
    await user.save();

    const clientUrl = process.env.CLIENT_URL || `${protocol}://${host}`;
    const resetUrl = `${clientUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;
    await sendEmail({
      email: user.email,
      subject: "Reset your NextCart password",
      message:
        `Hi ${user.name},\n\n` +
        `We received a request to reset your NextCart password.\n\n` +
        `Use this secure link within ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes:\n\n` +
        `${resetUrl}\n\n` +
        `If you did not request this, you can safely ignore this email.`,
    });
  }

  async resetPassword(token, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) throw new Error("Invalid or expired token");

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
  }
}

module.exports = new AuthService();

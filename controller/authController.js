const authService = require("../services/authService");
const User = require("../models/User");

exports.register = async (req, res, next) => {
  try {
    const user = await authService.registerUser(req.body, req.protocol, req.get("host"));
    res.status(201).json({
      message: "User registered! Please check your email to verify your account.",
      user
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const io = req.app.get("io");
    const result = await authService.loginUser(email, password, io);
    res.json({ message: "Login successful", ...result });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const io = req.app.get("io");
    await authService.verifyEmail(req.params.token, io);
    res.status(200).json({ message: "Email verified! You can now log in." });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email, req.protocol, req.get("host"));
    res.status(200).json({ message: "Token sent to email!" });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.params.token, req.body.password);
    res.status(200).json({ message: "Password reset successful!" });
  } catch (error) {
    next(error);
  }
};
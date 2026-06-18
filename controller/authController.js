const authService = require("../services/authService");
const User = require("../models/User");
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
    res.status(200).json({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
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

/**
 * Professional Google OAuth Authentication Pipeline
 * Validates integrity via Google identity certificates, forks registration vs login states,
 * and passes matching structural payloads out downstream.
 */
exports.googleAuth = async (req, res, next) => {
  const { idToken, role, longitude, latitude } = req.body;

  if (!idToken) {
    return res.status(400).json({ success: false, message: "Google verification ID Token is missing." });
  }

  try {
    // 1. Verify token validation authenticity directly via Google API
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, sub: googleId, name, picture } = payload;

    // 2. Safe-check incoming requested role structures
    const allowedRoles = ['customer', 'vendor'];
    const targetRole = allowedRoles.includes(role?.toLowerCase()) ? role.toLowerCase() : 'customer';

    // 3. Search database topology for matches
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // REGISTER FLOW: Formulate new model record instance
      console.log(`[OAUTH REGS] Launching profile allocation: ${email} as ${targetRole}`);
      
      const newUserData = {
        name,
        email,
        googleId,
        avatar: picture,
        role: targetRole,
        isVerified: true, // Google profiles are verified at origin
        password: crypto.randomBytes(32).toString('hex') // Strong internal password fallback
      };

      // Map optional geospatial telemetry parameters dynamically if present
      if (longitude !== undefined && latitude !== undefined) {
        newUserData.location = {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        };
      }

      user = new User(newUserData);
      await user.save();
    } else {
      // LOGIN / LINK FLOW: Bind profile identifiers to existing matching documents safely
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.avatar) user.avatar = picture;
        await user.save();
      }
      console.log(`[OAUTH AUTH] Session validation established for: ${user.email}`);
    }

    // 4. Generate local internal application JWT sign verification
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: "Authentication successful",
      token,
      result: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || picture
      }
    });

  } catch (error) {
    console.error("❌ Google OAuth Exception Core:", error.message);
    res.status(401).json({ success: false, message: "Google authentication handshake rejected." });
  }
};

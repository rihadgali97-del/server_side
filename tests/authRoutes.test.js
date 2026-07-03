const express = require("express");
const request = require("supertest");
const authRouter = require("../routes/authRoutes");
const authService = require("../services/authService");

// 1. Mock the underlying service layer so we don't send real emails or hit a real DB
jest.mock("../services/authService");

// 2. Mock the rate limiter middleware so it doesn't block our tests
jest.mock("../middleware/rateLimiter", () => ({
  authLimiter: (req, res, next) => next(),
}));

describe("Authentication Routes Integration API Suite", () => {
  let app;

  beforeAll(() => {
    // Instantiate a clean, ephemeral Express application instance for route execution
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);

    // Centralized fallback error handling middleware signature to capture controller rejections
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("POST /api/auth/register -> should pass payload, hit middleware, and return 201 on success", async () => {
    const validPayload = {
      name: "Rihad Gali",
      email: "rihad.dev@example.com",
      password: "strongPassword123"
    };

    authService.registerUser.mockResolvedValue({
      id: "mockUserId678",
      name: validPayload.name,
      email: validPayload.email
    });

    // Simulate an actual network request passing through the router stack
    const response = await request(app)
      .post("/api/auth/register")
      .send(validPayload)
      .expect("Content-Type", /json/)
      .expect(201);

    expect(response.body).toHaveProperty("message");
    expect(response.body.user.email).toBe(validPayload.email);
    expect(authService.registerUser).toHaveBeenCalledTimes(1);
  });

  it("POST /api/auth/register -> should cleanly catch service tier rejections and format a 500 JSON payload", async () => {
    authService.registerUser.mockRejectedValue(new Error("Email address registration collision."));

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Faulty Attempt",
        email: "duplicate@example.com",
        password: "password"
      })
      .expect(500);

    expect(response.body.message).toBe("Email address registration collision.");
  });
});
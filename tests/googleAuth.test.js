process.env.JWT_SECRET = "test_jwt_secret_key_allocation_xyz123";
process.env.GOOGLE_CLIENT_ID = "test_google_client_id_mock_456";

const express = require("express");
const request = require("supertest");
const authRouter = require("../routes/authRoutes");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

// 1. Mock the User model constructor to retain fields passed to it
jest.mock("../models/User", () => {
  const mockConstructor = jest.fn().mockImplementation((incomingData) => {
    return {
      ...incomingData,
      _id: "mocked_user_uuid_999",
      save: jest.fn().mockResolvedValue(this)
    };
  });
  
  // Attach static methods directly to the constructor mock
  mockConstructor.findOne = jest.fn();
  return mockConstructor;
});

// 2. Mock the Vendor model completely
jest.mock("../models/Vendor", () => ({
  create: jest.fn().mockResolvedValue({ success: true }),
  index: jest.fn()
}));

// 3. Bypass rate limiters in test environment
jest.mock("../middleware/rateLimiter", () => ({
  authLimiter: (req, res, next) => next()
}));

// 4. Mock Google Authentication handshake client completely
jest.mock('google-auth-library', () => {
  const mTicket = {
    getPayload: jest.fn().mockReturnValue({
      email: 'vendor.oauth@nextcart.com',
      sub: 'google_unique_id_123456',
      name: 'Oauth Vendor Test',
      picture: 'https://example.com/avatar.jpg'
    })
  };
  const mClient = {
    verifyIdToken: jest.fn().mockResolvedValue(mTicket)
  };
  return { OAuth2Client: jest.fn().mockImplementation(() => mClient) };
});

describe("Google OAuth Pipeline Integration Tests", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    
    // Express error boundary capturing middleware 
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("POST /api/auth/google-login -> Should initialize a new User and link a Vendor document dynamically", async () => {
    // Simulate that the incoming identity profile is completely unique
    User.findOne.mockResolvedValue(null);

    const oauthPayload = {
      idToken: "valid_mock_google_token_xyz",
      role: "vendor",
      faydaNumber: "ET-123456789",
      licenseNumber: "LIC-987654321",
      longitude: 38.74,
      latitude: 9.01
    };

    const response = await request(app)
      .post("/api/auth/google-login")
      .send(oauthPayload)
      .expect(200);

    // Verify response integrity matches structural specs
    expect(response.body.message).toBe("Authentication successful");
    expect(response.body).toHaveProperty("token");
    expect(response.body.result.role).toBe("vendor");
    expect(response.body.result.id).toBe("mocked_user_uuid_999");

    // Validate that our multi-vendor custom registration hooks execute cleanly
    expect(Vendor.create).toHaveBeenCalledTimes(1);
    expect(Vendor.create).toHaveBeenCalledWith(expect.objectContaining({
      user: "mocked_user_uuid_999",
      faydaNumber: "ET-123456789",
      licenseNumber: "LIC-987654321"
    }));
  });
});
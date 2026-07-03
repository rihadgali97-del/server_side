const authController = require("../controller/authController");
const authService = require("../services/authService");

// Safely mock the downstream authentication service layers
jest.mock("../services/authService");

describe("Authentication Controller Unit Test Handshakes", () => {
  let req, res, next;

  beforeEach(() => {
    // Reinitialize pristine Express mock ecosystems before each validation trace
    req = {
      body: {
        name: "Test Vendor",
        email: "vendor@nextcart.com",
        password: "secureVendorPassword123"
      },
      protocol: "http",
      get: jest.fn().mockReturnValue("localhost:5000")
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  it("should return 201 Created status and success message on pristine register pipeline match", async () => {
    const mockReturnedUser = {
      id: "mockedUserId123",
      name: "Test Vendor",
      email: "vendor@nextcart.com"
    };

    // Force authService pipeline to mock a complete registration allocation return
    authService.registerUser.mockResolvedValue(mockReturnedUser);

    await authController.register(req, res, next);

    // Assertions verifying your controllers process state logic securely
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "User registered! Please check your email to verify your account.",
      user: mockReturnedUser
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should capture runtime service execution anomalies and pass them out via Express next handler", async () => {
    const mockRuntimeError = new Error("Database validation timeout trace.");
    authService.registerUser.mockRejectedValue(mockRuntimeError);

    await authController.register(req, res, next);

    // Verify application errors route cleanly back into your global centralized handler
    expect(next).toHaveBeenCalledWith(mockRuntimeError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
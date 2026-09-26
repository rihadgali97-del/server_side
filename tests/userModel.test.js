const mongoose = require("mongoose");
const User = require("../models/User");

describe("User Model Schema Validation Tests", () => {
  
  // Test 1: Validation should catch missing required parameters
  it("should fail validation if required fields are missing", () => {
    const user = new User({}); // Empty payload

    const err = user.validateSync();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.email).toBeDefined();
    expect(err.errors.password).toBeDefined();
  });

  // Test 2: Digital Trust & Reputation System Default Configurations
  it("should correctly apply default values for GebeyaPlus digital trust layers", () => {
    const user = new User({
      name: "Rihad Gali",
      email: "rihad@example.com",
      password: "securePassword123"
    });

    // Verify digital trust score initializes securely
    expect(user.reputation.score).toBe(20);
    expect(user.reputation.rank).toBe("Starter");
    expect(user.reputation.metrics.successfulOrders).toBe(0);

    // Verify system notification defaults are enabled natively
    expect(user.settings.notifications.email).toBe(true);
    expect(user.settings.notifications.push).toBe(true);
    expect(user.isVerified).toBe(false);
  });

  // Test 3: Standardizing structural casing anomalies
  it("should automatically normalize email inputs to lowercase", () => {
    const user = new User({
      name: "Test User",
      email: "RIHAD@Example.COM",
      password: "securePassword123"
    });

    expect(user.email).toBe("rihad@example.com");
  });
});
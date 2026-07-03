// tests/walletService.test.js
const WalletService = require("../services/WalletService");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

// Mock the Mongoose models completely
jest.mock("../models/Wallet");
jest.mock("../models/Transaction");

describe("WalletService Core Engine Unit Tests", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrCreateWallet", () => {
    it("Should return an existing wallet if located via query", async () => {
      const mockWallet = { _id: "existing_wallet_id" };
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet)
      });

      const result = await WalletService.getOrCreateWallet("user_id_123");
      
      expect(result).toEqual(mockWallet);
      expect(Wallet.findOne).toHaveBeenCalledWith({
        $or: [{ user: "user_id_123" }, { vendor: "user_id_123" }]
      });
    });

    it("Should initialize a new customer wallet if missing", async () => {
      // Simulate no wallet found
      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null)
      });

      // Spy on the save method of the instantiated model
      const saveSpy = jest.fn().mockResolvedValue(true);
      Wallet.mockImplementation(() => {
        return {
          save: saveSpy
        };
      });

      await WalletService.getOrCreateWallet("customer_id_abc", null, false);

      // Verify that it attempted to construct a wallet with the user property
      expect(Wallet).toHaveBeenCalledWith(expect.objectContaining({
        user: "customer_id_abc"
      }));
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("creditAvailableFunds", () => {
    it("Should correctly increment spendable balances and log a ledger transaction", async () => {
      // Create a mock wallet instance using real JS Maps to match your schema methods
      const mockWalletInstance = {
        _id: "wallet_uuid_000",
        balances: new Map([["ETB", 150]]),
        isActive: true,
        isFrozen: false,
        save: jest.fn().mockResolvedValue(true)
      };

      Wallet.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWalletInstance)
      });
      Transaction.create.mockResolvedValue([{ success: true }]);

      const updatedWallet = await WalletService.creditAvailableFunds(
        "wallet_uuid_000",
        500,
        "ETB",
        "DEP-MOCK-REF-999"
      );

      // Check that 150 + 500 = 650 ETB
      expect(updatedWallet.balances.get("ETB")).toBe(650);
      expect(mockWalletInstance.save).toHaveBeenCalledTimes(1);

      // Check that the immutable transaction history log was generated correctly
      expect(Transaction.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            wallet: "wallet_uuid_000",
            amount: 500,
            type: "deposit",
            reference: "DEP-MOCK-REF-999",
            referenceType: "deposit",
            status: "completed"
          })
        ]),
        expect.any(Object)
      );
    });

    it("Should throw an error if the targeted wallet is frozen", async () => {
      const mockFrozenWallet = {
        _id: "wallet_frozen_111",
        isActive: true,
        isFrozen: true
      };

      Wallet.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockFrozenWallet)
      });

      await expect(
        WalletService.creditAvailableFunds("wallet_frozen_111", 100, "ETB", "REF")
      ).rejects.toThrow("Wallet wallet_frozen_111 is unavailable, inactive, or frozen.");
    });
  });
});
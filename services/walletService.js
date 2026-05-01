const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

class WalletService {
    /**
     * Finds a wallet by User ID or Vendor Profile ID, or creates one if missing.
     */
    async getOrCreateWallet(identifier, session = null) {
        let wallet = await Wallet.findOne({
            $or: [{ user: identifier }, { vendor: identifier }]
        }).session(session);

        if (!wallet) {
            wallet = new Wallet({
                user: identifier,
                balances: new Map([['ETB', 0]]),
                pending: new Map([['ETB', 0]])
            });
            await wallet.save({ session });
        }
        return wallet;
    }

    /**
     * Adds funds to the pending balance (Escrow).
     */
    async addPendingFunds(identifier, amount, currency = 'ETB', session = null) {
        const wallet = await this.getOrCreateWallet(identifier, session);
        
        const currentPending = wallet.pending.get(currency) || 0;
        wallet.pending.set(currency, currentPending + amount);
        
        await wallet.save({ session });
        return wallet;
    }

    /**
     * Moves funds from pending to available balance and records the transaction.
     */
    async releasePendingFunds(identifier, amount, currency = 'ETB', referenceId, itemName, session = null) {
        const wallet = await this.getOrCreateWallet(identifier, session);
        
        const currentPending = wallet.pending.get(currency) || 0;
        const currentBalance = wallet.balances.get(currency) || 0;

        if (currentPending < amount) {
            throw new Error(`Insufficient pending funds for wallet ${wallet._id}`);
        }

        // Update balances
        wallet.pending.set(currency, currentPending - amount);
        wallet.balances.set(currency, currentBalance + amount);
        await wallet.save({ session });

        // Create transaction record
        await Transaction.create([{
            wallet: wallet._id,
            amount,
            type: 'release',
            description: `Fulfillment Payout: ${itemName}`,
            reference: referenceId,
            referenceType: 'order',
            status: 'completed'
        }], { session });

        return wallet;
    }
}

module.exports = new WalletService();
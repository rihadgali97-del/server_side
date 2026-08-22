const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

class WalletService {
    async getOrCreateWallet(identifier, session = null, isVendor = false) {
        let wallet = await Wallet.findOne({
            $or: [{ user: identifier }, { vendor: identifier }]
        }).session(session);

        if (!wallet) {
            const walletData = {
                balances: new Map([['ETB', 0]]),
                pending: new Map([['ETB', 0]])
            };

            // Dynamically allocate the correct foreign key relationship
            if (isVendor) {
                walletData.vendor = identifier;
            } else {
                walletData.user = identifier;
            }

            wallet = new Wallet(walletData);
            await wallet.save({ session });
        }
        return wallet;
    }

    
        //Adds funds to the pending balance (Escrow).

    async addPendingFunds(identifier, amount, currency = 'ETB', session = null, isVendor = false) {
        const wallet = await this.getOrCreateWallet(identifier, session, isVendor);
        
        if (!wallet.isActive || wallet.isFrozen) {
            throw new Error(`Wallet ${wallet._id} is currently inactive or frozen`);
        }

        const currentPending = wallet.pending.get(currency) || 0;
        wallet.pending.set(currency, currentPending + amount);
        
        await wallet.save({ session });
        return wallet;
    }
    
      //Moves funds from pending to available balance and records the transaction.
     
    async releasePendingFunds(identifier, amount, currency = 'ETB', referenceId, itemName, session = null, isVendor = false) {
        const wallet = await this.getOrCreateWallet(identifier, session, isVendor);
        
        if (!wallet.isActive || wallet.isFrozen) {
            throw new Error(`Wallet ${wallet._id} is currently inactive or frozen`);
        }

        const currentPending = wallet.pending.get(currency) || 0;
        const currentBalance = wallet.balances.get(currency) || 0;

        if (currentPending < amount) {
            throw new Error(`Insufficient pending funds for wallet ${wallet._id}`);
        }

        // Update map balances safely
        wallet.pending.set(currency, currentPending - amount);
        wallet.balances.set(currency, currentBalance + amount);
        await wallet.save({ session });

        // Create an unalterable transaction ledger entry
        await Transaction.create([{
            wallet: wallet._id,
            amount,
            currency,
            type: 'release',
            description: `Fulfillment Payout: ${itemName}`,
            reference: referenceId,
            referenceType: 'order',
            status: 'completed'
        }], { session });

        return wallet;
    }
    
     //Directly credits a user's available balance after a successful gateway deposit.
     // Tied directly into the asynchronous checkout and top-up webhook loops.

    async creditAvailableFunds(walletId, amount, currency = 'ETB', referenceId, session = null) {
        const wallet = await Wallet.findById(walletId).session(session);
        
        if (!wallet) {
            throw new Error(`Wallet with ID ${walletId} could not be located.`);
        }
        if (!wallet.isActive || wallet.isFrozen) {
            throw new Error(`Wallet ${wallet._id} is unavailable, inactive, or frozen.`);
        }

        const currentBalance = wallet.balances.get(currency) || 0;
        wallet.balances.set(currency, currentBalance + amount);
        await wallet.save({ session });

        // Generate immediate auditable ledger trail tracking the load action
        await Transaction.create([{
            wallet: wallet._id,
            amount,
            currency,
            type: 'deposit',
            description: `Wallet top-up via external payment gateway`,
            reference: referenceId,
            referenceType: 'deposit',
            status: 'completed'
        }], { session });

        return wallet;
    }
}

module.exports = new WalletService();
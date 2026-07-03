const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

// @desc    Get vendor wallet statistics and transaction history
// @route   GET /api/vendors/wallet
// @access  Protected (Vendor)
exports.getVendorWallet = async (req, res) => {
  try {
    // Ensure you are using the authenticated user's ID
    const userId = req.user._id;

    // 1. Fetch the wallet associated with this user
    let wallet = await Wallet.findOne({ user: userId });
    
    // Fallback: If no wallet exists yet, create an empty one
    if (!wallet) {
      wallet = await Wallet.create({ user: userId });
    }

    // 2. Fetch all transactions for this specific wallet
    const transactions = await Transaction.find({ wallet: wallet._id })
      .sort({ createdAt: -1 });

    // 3. Extract exact ETB balances from your schema's Map structure
    const balance = wallet.balances.get('ETB') || 0;
    const pending = wallet.pending.get('ETB') || 0;
    
    // 4. Calculate total withdrawn
    const withdrawn = transactions
      .filter(t => t.type === 'withdrawal' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    // 5. Calculate Gross Volume (deposits and credits combined)
    const grossVolume = transactions
      .filter(t => (t.type === 'credit' || t.type === 'deposit') && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    // 6. Send the structured response to the frontend
    res.status(200).json({
      success: true,
      wallet: {
        balance,
        pending,
        withdrawn,
        grossVolume
      },
      transactions
    });

  } catch (error) {
    console.error('❌ Vendor Wallet Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
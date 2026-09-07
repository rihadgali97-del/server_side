const Wallet      = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Vendor      = require('../models/Vendor');
const User        = require('../models/User');

// ─── Shared helper: get wallet + ETB balances ──────────────────────────────────
const getWalletData = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) wallet = await Wallet.create({ user: userId });

  const transactions = await Transaction.find({ wallet: wallet._id })
    .sort({ createdAt: -1 });

  const balance     = wallet.balances.get('ETB') || 0;
  const pending     = wallet.pending.get('ETB')  || 0;
  const withdrawn   = transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const grossVolume = transactions
    .filter(t => ['credit','deposit'].includes(t.type) && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  return { wallet, transactions, balance, pending, withdrawn, grossVolume };
};

// ─── GET /api/vendors/wallet ───────────────────────────────────────────────────
// Unchanged from your original — just refactored to use shared helper
exports.getVendorWallet = async (req, res) => {
  try {
    const { wallet, transactions, balance, pending, withdrawn, grossVolume } =
      await getWalletData(req.user._id);

    res.status(200).json({
      success: true,
      wallet:  { balance, pending, withdrawn, grossVolume },
      transactions,
    });
  } catch (err) {
    console.error('❌ Vendor Wallet Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/vendors/wallet/withdraw ────────────────────────────────────────
exports.withdrawFunds = async (req, res) => {
  try {
    const { amount, method, accountDetails } = req.body;
    const userId = req.user._id;

    // ── Validation ─────────────────────────────────────────────────────────────
    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0)
      return res.status(400).json({ success:false, message:'Invalid withdrawal amount' });
    if (withdrawAmount < 50)
      return res.status(400).json({ success:false, message:'Minimum withdrawal is 50 ETB' });
    if (!method)
      return res.status(400).json({ success:false, message:'Payment method is required' });

    // ── Get wallet ──────────────────────────────────────────────────────────────
    const { wallet, balance } = await getWalletData(userId);
    if (balance < withdrawAmount)
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ${balance} ETB`,
      });

    // ── Deduct from ETB balance ─────────────────────────────────────────────────
    wallet.balances.set('ETB', balance - withdrawAmount);
    await wallet.save();

    // ── Record transaction ──────────────────────────────────────────────────────
    const txId = `WD-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const transaction = await Transaction.create({
      wallet:      wallet._id,
      type:        'withdrawal',
      amount:      withdrawAmount,
      currency:    'ETB',
      status:      'pending',
      description: `Withdrawal via ${method}`,
      reference:   txId,
      metadata:    { method, accountDetails: accountDetails || {} },
    });

    // ── Send payout email (non-blocking) ────────────────────────────────────────
    try {
      const emailService = require('../services/emailService');
      const vendor = await Vendor.findOne({ user: userId });
      const user   = await User.findById(userId);
      if (user && vendor)
        emailService.sendVendorPayoutConfirmation(vendor, user, withdrawAmount, method, txId);
    } catch { /* email failure must never crash the withdraw */ }

    res.status(200).json({
      success: true,
      message: `Withdrawal of ${withdrawAmount.toLocaleString()} ETB initiated`,
      data: {
        txId,
        transaction,
        newBalance: wallet.balances.get('ETB'),
      },
    });
  } catch (err) {
    console.error('❌ Withdraw Error:', err.message);
    res.status(500).json({ success:false, message: err.message });
  }
};
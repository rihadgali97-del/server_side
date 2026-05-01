const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

const buildPagination = (page, limit) => {
    const currentPage = Number(page) || 1;
    const pageSize = Number(limit) || 10;
    const skip = (currentPage - 1) * pageSize;
    return { currentPage, pageSize, skip };
};

const findUserById = async (id, selectPassword = false) => {
    const query = User.findById(id);
    if (!selectPassword) query.select('-password');
    const user = await query;
    if (!user) throw new Error('User not found');
    return user;
};

const updateUserData = async (id, updateFields) => {
    const user = await User.findById(id);
    if (!user) throw new Error('User not found');

    Object.keys(updateFields).forEach((key) => {
        if (updateFields[key] !== undefined) {
            user[key] = updateFields[key];
        }
    });

    return await user.save();
};

const fetchPaginatedUsers = async (page, limit) => {
    const { currentPage, pageSize, skip } = buildPagination(page, limit);

    const users = await User.find()
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

    const total = await User.countDocuments();
    return { 
        users, 
        total, 
        currentPage, 
        pageSize, 
        totalPages: Math.ceil(total / pageSize) 
    };
};

const removeUserAccount = async (id) => {
    const user = await User.findById(id);
    if (!user) throw new Error('User not found');
    return await user.deleteOne();
};

const fetchWalletWithHistory = async (userId) => {
    const wallet = await Wallet.findOne({ user: userId }).populate('transactions');
    if (!wallet) throw new Error('Wallet not found');
    return wallet;
};

const fetchPaginatedTransactions = async (userId, page, limit) => {
    const { currentPage, pageSize, skip } = buildPagination(page, limit);
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) throw new Error('Wallet not found');

    const transactions = await Transaction.find({ wallet: wallet._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

    const total = await Transaction.countDocuments({ wallet: wallet._id });
    
    return {
        transactions,
        total,
        currentPage,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
};

module.exports = {
    findUserById,
    updateUserData,
    fetchPaginatedUsers,
    removeUserAccount,
    fetchWalletWithHistory,
    fetchPaginatedTransactions
};
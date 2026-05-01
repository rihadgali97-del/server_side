const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');

const buildPagination = (page = 1, limit = 10) => {
  const currentPage = Number(page) || 1;
  const pageSize = Math.max(Number(limit) || 10, 1);
  const skip = (currentPage - 1) * pageSize;
  return { currentPage, pageSize, skip };
};

const normalizeCode = (code) => {
  if (!code) return '';
  return String(code).trim().toUpperCase();
};

const validateObjectId = (id, name = 'id') => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${name}`);
  }
  return mongoose.Types.ObjectId(id);
};

const buildCouponPayload = (data) => ({
  code: normalizeCode(data.code),
  discountType: data.discountType,
  value: Number(data.value) || 0,
  minOrderAmount: Number(data.minOrderAmount) || 0,
  expiryDate: data.expiryDate ? new Date(data.expiryDate) : null
});

const isCouponActive = (coupon) => {
  if (!coupon || !coupon.expiryDate) {
    return false;
  }
  return coupon.expiryDate > new Date();
};

const calculateDiscount = (coupon, cartTotal) => {
  if (!coupon || cartTotal < 0) {
    return 0;
  }

  const base = Number(cartTotal) || 0;

  if (coupon.discountType === 'percentage') {
    return Math.min((base * Number(coupon.value || 0)) / 100, base);
  }

  return Math.min(Number(coupon.value || 0), base);
};

const createCoupon = async (data) => {
  if (!data || !data.code) {
    throw new Error('Coupon code is required');
  }

  const code = normalizeCode(data.code);
  const existing = await Coupon.findOne({ code });
  if (existing) {
    throw new Error('Coupon code already exists');
  }

  return Coupon.create(buildCouponPayload({ ...data, code }));
};

const getCouponById = async (couponId) => {
  validateObjectId(couponId, 'couponId');
  return Coupon.findById(couponId);
};

const getCouponByCode = async (code) => {
  if (!code) {
    return null;
  }
  return Coupon.findOne({ code: normalizeCode(code) });
};

const listCoupons = async ({ page = 1, limit = 20, activeOnly = false } = {}) => {
  const { currentPage, pageSize, skip } = buildPagination(page, limit);
  const filter = {};

  if (activeOnly) {
    filter.expiryDate = { $gt: new Date() };
  }

  const [total, coupons] = await Promise.all([
    Coupon.countDocuments(filter),
    Coupon.find(filter)
      .sort({ expiryDate: 1, code: 1 })
      .skip(skip)
      .limit(pageSize)
  ]);

  return {
    coupons,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      pages: Math.max(Math.ceil(total / pageSize), 1)
    }
  };
};

const updateCoupon = async (couponId, updates) => {
  validateObjectId(couponId, 'couponId');

  if (updates.code) {
    updates.code = normalizeCode(updates.code);
    const existing = await Coupon.findOne({ code: updates.code, _id: { $ne: couponId } });
    if (existing) {
      throw new Error('Coupon code already exists');
    }
  }

  if (updates.expiryDate) {
    updates.expiryDate = new Date(updates.expiryDate);
  }

  if (updates.value !== undefined) {
    updates.value = Number(updates.value) || 0;
  }

  if (updates.minOrderAmount !== undefined) {
    updates.minOrderAmount = Number(updates.minOrderAmount) || 0;
  }

  return Coupon.findByIdAndUpdate(couponId, updates, { new: true, runValidators: true });
};

const deleteCoupon = async (couponId) => {
  validateObjectId(couponId, 'couponId');
  return Coupon.findByIdAndDelete(couponId);
};

const validateCoupon = async (code, cartTotal = 0) => {
  if (!code) {
    return { valid: false, message: 'Coupon code is required' };
  }

  const coupon = await getCouponByCode(code);
  if (!coupon) {
    return { valid: false, message: 'Coupon not found' };
  }

  if (!isCouponActive(coupon)) {
    return { valid: false, message: 'Coupon has expired', coupon };
  }

  if (cartTotal < Number(coupon.minOrderAmount || 0)) {
    return {
      valid: false,
      message: `Order total must be at least ${coupon.minOrderAmount}`,
      coupon
    };
  }

  const discount = calculateDiscount(coupon, cartTotal);

  return {
    valid: true,
    coupon,
    discount,
    message: 'Coupon applied successfully'
  };
};

module.exports = {
  createCoupon,
  getCouponById,
  getCouponByCode,
  listCoupons,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  calculateDiscount,
  isCouponActive
};

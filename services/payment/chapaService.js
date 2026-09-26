const axios = require('axios');
const User = require('../../models/User');

const CHAPA_API_URL = 'https://api.chapa.co/v1';

const getSecretKey = () => {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) throw new Error('Chapa is not configured. Set CHAPA_SECRET_KEY on the server.');
  return secretKey;
};

const initializeTransaction = async (order) => {
  const user = await User.findById(order.user).select('name email');
  if (!user?.email) throw new Error('Customer email is required to initialize Chapa checkout.');
  if (!process.env.FRONTEND_URL) throw new Error('FRONTEND_URL is required for Chapa checkout.');
  const txRef = `gp-${Date.now()}-${order._id.toString().slice(-8)}`;
  const nameParts = (user.name || '').trim().split(/\s+/);
  const payload = {
    amount: String(order.totalPrice),
    currency: process.env.CHAPA_CURRENCY || 'ETB',
    email: user.email,
    first_name: nameParts[0] || 'Customer',
    last_name: nameParts.slice(1).join(' ') || 'GebeyaPlus',
    tx_ref: txRef,
    return_url: `${process.env.FRONTEND_URL.replace(/\/$/, '')}/payment-success?orderId=${order._id}&provider=chapa`,
    customization: {
      title: 'GebeyaPlus',
      description: `Order ${order._id}`,
    },
  };

  const callbackUrl = process.env.CHAPA_CALLBACK_URL
    || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/$/, '')}/api/payments/chapa/callback` : null);
  if (callbackUrl) {
    try {
      const callbackHost = new URL(callbackUrl).hostname.toLowerCase();
      const isLocalCallback = ['localhost', '127.0.0.1', '::1'].includes(callbackHost);
      if (!isLocalCallback) payload.callback_url = callbackUrl;
    } catch {
      throw new Error('CHAPA_CALLBACK_URL or BACKEND_URL must be a valid URL.');
    }
  }

  const { data } = await axios.post(`${CHAPA_API_URL}/transaction/initialize`, payload, {
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
  const checkoutUrl = data?.data?.checkout_url;
  if (data?.status !== 'success' || !checkoutUrl) {
    throw new Error(typeof data?.message === 'string' ? data.message : 'Chapa did not return a checkout URL.');
  }

  return { txRef, checkoutUrl };
};

const verifyTransaction = async (txRef) => {
  if (!txRef) throw new Error('Chapa transaction reference is required.');
  const { data } = await axios.get(`${CHAPA_API_URL}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${getSecretKey()}` },
    timeout: 15000,
  });
  return data;
};

module.exports = { initializeTransaction, verifyTransaction };

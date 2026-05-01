const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');

const DEFAULT_CURRENCY = 'USD';
const gatewayRegistry = new Map();

const normalizeCurrency = (currency) => {
  if (!currency) return DEFAULT_CURRENCY;
  return currency.toUpperCase();
};

const throwIfInvalidAmount = (amount) => {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
};

const throwIfFrozenOrInactive = (wallet) => {
  if (!wallet.isActive) {
    throw new Error('Wallet is not active');
  }
  if (wallet.isFrozen) {
    throw new Error(`Wallet is frozen${wallet.freezeReason ? `: ${wallet.freezeReason}` : ''}`);
  }
};

const registerGateway = (name, adapter) => {
  if (!name || !adapter || typeof adapter.charge !== 'function' || typeof adapter.refund !== 'function') {
    throw new Error('Gateway adapter must include charge and refund methods');
  }
  gatewayRegistry.set(name.toLowerCase(), adapter);
};

const getGateway = (name) => {
  const provider = gatewayRegistry.get(name.toLowerCase());
  if (!provider) {
    throw new Error(`Payment provider not supported: ${name}`);
  }
  return provider;
};

const getSupportedProviders = () => Array.from(gatewayRegistry.keys());

const createPaymentTransaction = async ({
  order,
  wallet,
  type,
  amount,
  currency,
  description,
  provider,
  reference,
  referenceType,
  status = 'completed',
  fee = 0,
  exchangeRate = 1,
  metadata = {},
  session
}) => {
  const transaction = await Transaction.create([
    {
      wallet: wallet ? wallet._id : null,
      type,
      amount,
      currency,
      description,
      reference,
      referenceType,
      status,
      fee,
      exchangeRate,
      metadata: {
        provider,
        ...metadata
      },
      processedAt: new Date()
    }
  ], { session });

  if (wallet && transaction.length) {
    await Wallet.findByIdAndUpdate(wallet._id, { $push: { transactions: transaction[0]._id } }, { session });
  }

  return transaction[0];
};

const prepareOrder = async (orderId) => {
  if (!orderId) {
    throw new Error('Order ID is required');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.isPaid) {
    throw new Error('Order is already paid');
  }

  return order;
};

const processOrderPayment = async ({ orderId, paymentMethod, amount, currency = DEFAULT_CURRENCY, metadata = {}, referenceType = 'payment' }) => {
  const order = await prepareOrder(orderId);
  const provider = getGateway(paymentMethod);
  const normalizedCurrency = normalizeCurrency(currency);
  throwIfInvalidAmount(amount);

  const paymentResult = await provider.charge({ order, amount, currency: normalizedCurrency, metadata });

  if (!paymentResult.success) {
    return { success: false, error: paymentResult.error || 'Payment failed', paymentResult };
  }

  const session = await Order.startSession();
  try {
    await session.withTransaction(async () => {
      order.isPaid = true;
      order.paidAt = new Date();
      order.paymentMethod = paymentMethod;
      await order.save({ session });

      await createPaymentTransaction({
        order,
        wallet: null,
        type: 'deposit',
        amount,
        currency: normalizedCurrency,
        description: `Paid order ${order._id}`,
        provider: paymentMethod,
        reference: paymentResult.transactionId || order._id.toString(),
        referenceType,
        status: paymentResult.status || 'completed',
        fee: paymentResult.fee || 0,
        exchangeRate: paymentResult.exchangeRate || 1,
        metadata: paymentResult.metadata || metadata,
        session
      });
    });
  } finally {
    session.endSession();
  }

  return { success: true, order, paymentResult };
};

const refundOrderPayment = async ({ orderId, amount, currency = DEFAULT_CURRENCY, reason = 'Refund', metadata = {} }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (!order.isPaid) {
    throw new Error('Order is not paid');
  }

  const provider = getGateway(order.paymentMethod);
  const normalizedCurrency = normalizeCurrency(currency);
  throwIfInvalidAmount(amount);

  const refundResult = await provider.refund({ order, amount, currency: normalizedCurrency, reason, metadata });

  if (!refundResult.success) {
    return { success: false, error: refundResult.error || 'Refund failed', refundResult };
  }

  await createPaymentTransaction({
    order,
    wallet: null,
    type: 'refund',
    amount,
    currency: normalizedCurrency,
    description: `Refund for order ${order._id}`,
    provider: order.paymentMethod,
    reference: refundResult.transactionId || order._id.toString(),
    referenceType: 'refund',
    status: refundResult.status || 'completed',
    fee: refundResult.fee || 0,
    exchangeRate: refundResult.exchangeRate || 1,
    metadata: refundResult.metadata || metadata
  });

  return { success: true, refundResult };
};

const getPaymentStatus = async ({ paymentMethod, reference }) => {
  const provider = getGateway(paymentMethod);
  return provider.status({ reference });
};

const getPaymentSummary = async ({ orderId }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const transactions = await Transaction.find({ reference: order._id.toString(), referenceType: 'payment' }).sort({ createdAt: -1 });
  return { order, transactions };
};

const baseGatewayAdapter = (name) => ({
  charge: async ({ order, amount, currency }) => ({
    success: true,
    provider: name,
    transactionId: `${name.toUpperCase()}-${Date.now()}`,
    status: 'completed',
    amount,
    currency,
    exchangeRate: 1,
    metadata: { orderId: order._id.toString() }
  }),
  refund: async ({ order, amount, currency }) => ({
    success: true,
    provider: name,
    transactionId: `${name.toUpperCase()}-REFUND-${Date.now()}`,
    status: 'completed',
    amount,
    currency,
    exchangeRate: 1,
    metadata: { orderId: order._id.toString() }
  }),
  status: async ({ reference }) => ({
    success: true,
    provider: name,
    reference,
    status: 'completed'
  })
});

registerGateway('cash', baseGatewayAdapter('cash'));
registerGateway('telebirr', baseGatewayAdapter('telebirr'));
registerGateway('cbe', baseGatewayAdapter('cbe'));
registerGateway('stripe', baseGatewayAdapter('stripe'));

module.exports = {
  getSupportedProviders,
  registerGateway,
  processOrderPayment,
  refundOrderPayment,
  getPaymentStatus,
  getPaymentSummary
};
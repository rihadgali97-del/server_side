const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const notificationService = require('./notificationService');

const buildPagination = (page = 1, limit = 10) => {
  const currentPage = Number(page) || 1;
  const pageSize = Number(limit) || 10;
  const skip = (currentPage - 1) * pageSize;
  return { currentPage, pageSize, skip };
};

const normalizeItem = (item) => {
  if (!item || !item.product) {
    throw new Error('Inventory item must include a product id');
  }

  return {
    product: mongoose.Types.ObjectId(item.product),
    variant: item.variant ? mongoose.Types.ObjectId(item.variant) : null,
    quantity: Number(item.quantity) || 0
  };
};

const findInventoryTarget = async ({ product, variant }, session = null) => {
  if (variant) {
    const variantDoc = await ProductVariant.findById(variant).session(session);
    if (!variantDoc) {
      throw new Error(`Product variant not found: ${variant}`);
    }
    return { target: variantDoc, type: 'variant' };
  }

  const productDoc = await Product.findById(product).session(session);
  if (!productDoc) {
    throw new Error(`Product not found: ${product}`);
  }

  return { target: productDoc, type: 'product' };
};

const getInventoryStatus = async ({ productId, variantId }) => {
  const target = variantId ? await ProductVariant.findById(variantId) : await Product.findById(productId);
  if (!target) {
    throw new Error('Inventory item not found');
  }

  return {
    id: target._id,
    type: variantId ? 'variant' : 'product',
    stock: target.stock,
    lowStockThreshold: variantId ? null : target.lowStockThreshold,
    product: variantId ? target.product : target._id
  };
};

const adjustInventory = async ({ productId, variantId, quantity, session = null, allowNegative = false }) => {
  if (!quantity || Number.isNaN(quantity)) {
    throw new Error('Quantity must be a valid number');
  }

  const adjustment = Number(quantity);
  const { target, type } = await findInventoryTarget({ product: productId, variant: variantId }, session);

  const nextStock = target.stock + adjustment;
  if (!allowNegative && nextStock < 0) {
    throw new Error(`Insufficient stock for ${type} ${target._id}`);
  }

  target.stock = nextStock;
  await target.save({ session });

  return target;
};

const deductInventory = async ({ productId, variantId, quantity, session = null }) => {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  return adjustInventory({ productId, variantId, quantity: -Math.abs(quantity), session });
};

const restockInventory = async ({ productId, variantId, quantity, session = null }) => {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  return adjustInventory({ productId, variantId, quantity: Math.abs(quantity), session });
};

const reserveInventory = async ({ items, session = null }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Inventory reservation requires at least one item');
  }

  const activeSession = session || await mongoose.startSession();
  let createdSession = false;
  if (!session) {
    createdSession = true;
    activeSession.startTransaction();
  }

  try {
    const reservations = [];

    for (const rawItem of items) {
      const item = normalizeItem(rawItem);
      if (item.quantity <= 0) {
        throw new Error('Inventory quantity must be greater than zero');
      }
      const updated = await deductInventory({
        productId: item.product,
        variantId: item.variant,
        quantity: item.quantity,
        session: activeSession
      });
      reservations.push(updated);
    }

    if (createdSession) {
      await activeSession.commitTransaction();
    }

    return reservations;
  } catch (error) {
    if (createdSession) {
      await activeSession.abortTransaction();
    }
    throw error;
  } finally {
    if (createdSession) {
      activeSession.endSession();
    }
  }
};

const releaseInventory = async ({ items, session = null }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Inventory release requires at least one item');
  }

  const activeSession = session || await mongoose.startSession();
  let createdSession = false;
  if (!session) {
    createdSession = true;
    activeSession.startTransaction();
  }

  try {
    const releases = [];
    for (const rawItem of items) {
      const item = normalizeItem(rawItem);
      if (item.quantity <= 0) {
        throw new Error('Inventory quantity must be greater than zero');
      }
      const updated = await restockInventory({
        productId: item.product,
        variantId: item.variant,
        quantity: item.quantity,
        session: activeSession
      });
      releases.push(updated);
    }

    if (createdSession) {
      await activeSession.commitTransaction();
    }

    return releases;
  } catch (error) {
    if (createdSession) {
      await activeSession.abortTransaction();
    }
    throw error;
  } finally {
    if (createdSession) {
      activeSession.endSession();
    }
  }
};

const findLowStockItems = async ({ threshold = 10, limit = 50, page = 1, variantAware = true } = {}) => {
  const { currentPage, pageSize, skip } = buildPagination(page, limit);
  const productFilter = { stock: { $lte: threshold } };
  const lowProducts = await Product.find(productFilter)
    .populate({ path: 'vendor', populate: { path: 'user', select: 'name email' } })
    .skip(skip)
    .limit(pageSize)
    .lean();

  const result = lowProducts.map((product) => ({
    id: product._id,
    type: 'product',
    name: product.name,
    stock: product.stock,
    threshold: product.lowStockThreshold,
    vendor: product.vendor
  }));

  if (!variantAware) {
    return { items: result, pagination: { page: currentPage, limit: pageSize, total: result.length, pages: 1 } };
  }

  const lowVariants = await ProductVariant.find({ stock: { $lte: threshold } })
    .populate({ path: 'product', populate: { path: 'vendor', populate: { path: 'user', select: 'name email' } } })
    .skip(skip)
    .limit(pageSize)
    .lean();

  const variantResults = lowVariants.map((variant) => ({
    id: variant._id,
    type: 'variant',
    name: `${variant.product.name} (${variant.size}, ${variant.color})`,
    stock: variant.stock,
    threshold,
    vendor: variant.product.vendor
  }));

  return {
    items: [...result, ...variantResults],
    pagination: {
      page: currentPage,
      limit: pageSize,
      total: result.length + variantResults.length,
      pages: 1
    }
  };
};

const notifyLowStock = async ({ threshold = 10, type = 'alert', messageTemplate }) => {
  const lowItems = await findLowStockItems({ threshold, variantAware: true });
  const alerts = [];

  for (const item of lowItems.items) {
    if (!item.vendor) {
      continue;
    }

    const userId = item.vendor.user || item.vendor;
    const message = messageTemplate
      ? messageTemplate(item)
      : `${item.type === 'variant' ? 'Variant' : 'Product'} "${item.name}" is low on stock (${item.stock}). Please restock soon.`;

    const notification = await notificationService.createNotification({
      userId,
      title: 'Inventory Low Stock Alert',
      message,
      type
    });

    alerts.push(notification);
  }

  return alerts;
};

module.exports = {
  getInventoryStatus,
  adjustInventory,
  deductInventory,
  restockInventory,
  reserveInventory,
  releaseInventory,
  findLowStockItems,
  notifyLowStock
};
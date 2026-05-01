const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const nodemailer = require('nodemailer');

// Email Configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const buildPagination = (page = 1, limit = 10) => {
  const currentPage = Number(page) || 1;
  const pageSize = Number(limit) || 10;
  const skip = (currentPage - 1) * pageSize;
  return { currentPage, pageSize, skip };
};

/**
 * CORE LOGIC: Save to DB and Emit Socket
 */
const createNotification = async ({ io, userId, title, message, type = 'info', metadata = {} }) => {
  if (!userId) throw new Error('Notification must have a recipient');

  const notification = await Notification.create({
    user: userId,
    title,
    message,
    type,
    metadata
  });

  if (io) {
    io.to(userId.toString()).emit('notification', notification);
    console.log(`🔔 Socket Notification emitted to: ${userId}`);
  }

  return notification;
};

/**
 * EMAIL WRAPPER: Prevents app crashes if Mailtrap/MailHog fails
 */
const attemptEmailSend = async (mailOptions) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📩 Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ EMAIL SERVICE ERROR:", error.message);
    console.log("Proceeding without sending email to:", mailOptions.to);
    return null;
  }
};

/**
 * SPECIALIZED FUNCTIONS
 */

// 1. Low Stock Alert
const sendLowStockAlert = async ({ io, vendorEmail, userId, product }) => {
  const title = "⚠️ Low Stock Alert";
  const message = `Product ${product.name} is low on stock (${product.stock} remaining).`;
  
  await createNotification({ io, userId, title, message, type: 'warning' });

  await attemptEmailSend({
    from: '"NextCart Inventory" <inventory@nextcart.com>',
    to: vendorEmail,
    subject: title,
    html: `<p>${message}</p><br/><a href="${process.env.FRONTEND_URL}/inventory">Update Stock</a>`
  });
};

// 2. Order Status Update (Notify Customer)
const sendOrderStatusNotification = async ({ io, userEmail, userId, orderId, status }) => {
  const title = `📦 Order ${status.toUpperCase()}`;
  const message = `Your order #${orderId.toString().slice(-6)} has been updated to: ${status}.`;
  
  await createNotification({ io, userId, title, message, type: 'success' });

  await attemptEmailSend({
    from: '"NextCart Orders" <orders@nextcart.com>',
    to: userEmail,
    subject: title,
    html: `<h3>Status Update</h3><p>${message}</p>`
  });
};

// 3. New Order Received (Notify Vendor)
const sendNewOrderNotification = async ({ io, vendorEmail, userId, orderId }) => {
  const title = "💰 New Order Received!";
  const message = `You have a new order (#${orderId.toString().slice(-6)}). Check your vendor dashboard.`;

  await createNotification({ io, userId, title, message, type: 'success' });

  await attemptEmailSend({
    from: '"NextCart Sales" <sales@nextcart.com>',
    to: vendorEmail,
    subject: title,
    html: `<h3>Cha-Ching!</h3><p>${message}</p>`
  });
};

// 4. Security Alert (New Login)
const sendSecurityAlert = async ({ io, userEmail, userId }) => {
  const title = "🔒 New Login Detected";
  const message = `A new login was detected for your account at ${new Date().toLocaleString()}.`;

  await createNotification({ io, userId, title, message, type: 'alert' });

  await attemptEmailSend({
    from: '"NextCart Security" <security@nextcart.com>',
    to: userEmail,
    subject: title,
    html: `<h3>Security Alert</h3><p>${message}</p>`
  });
};

// 5. Vendor Rank Update (New)
const sendVendorRankNotification = async ({ io, vendorEmail, userId, newRank }) => {
  const title = "🌟 Level Up! Your Rank Updated";
  const message = `Congratulations! Your vendor rank has been updated to: ${newRank}. Keep up the great work!`;

  await createNotification({ 
    io, 
    userId, 
    title, 
    message, 
    type: 'success', 
    metadata: { rank: newRank } 
  });

  await attemptEmailSend({
    from: '"NextCart Partners" <partners@nextcart.com>',
    to: vendorEmail,
    subject: title,
    html: `<h3>Congratulations!</h3><p>${message}</p>`
  });
};

/**
 * DATA FETCHING LOGIC
 */
const getNotifications = async ({ userId, page = 1, limit = 10, read, type }) => {
  if (!userId) throw new Error('User ID is required');
  const { currentPage, pageSize, skip } = buildPagination(page, limit);
  const filter = { user: userId };
  
  if (typeof read === 'boolean') filter.read = read;
  if (type) filter.type = type;

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  const total = await Notification.countDocuments(filter);
  
  return { 
    notifications, 
    pagination: { 
      page: currentPage, 
      limit: pageSize, 
      total, 
      pages: Math.ceil(total / pageSize) 
    } 
  };
};

const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ user: userId, read: false });
};

const markAsRead = async (notificationId, userId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId }, 
    { read: true }, 
    { new: true }
  );
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany({ user: userId, read: false }, { read: true });
  return { message: "All marked as read" };
};

module.exports = {
  createNotification,
  sendLowStockAlert,
  sendOrderStatusNotification,
  sendNewOrderNotification,
  sendSecurityAlert,
  sendVendorRankNotification, 
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const nodemailer = require('nodemailer');

// 🛠️ Gmail Unified Configuration
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
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
 * EMAIL HTML ENGINE: Generates responsive production templates with action buttons
 */
const generateEmailTemplate = (title, message, buttonText, buttonUrl) => {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="padding-bottom: 20px; border-bottom: 2px solid #f1f5f9; text-align: center;">
        <h2 style="color: #0f172a; margin: 0; font-size: 24px;">NextCart Platforms</h2>
      </div>
      <div style="padding: 24px 0;">
        <h3 style="color: #1e293b; margin-top: 0; font-size: 18px;">${title}</h3>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 28px;">${message}</p>
        ${buttonText && buttonUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${buttonUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; display: inline-block; transition: background-color 0.2s;">
              ${buttonText}
            </a>
          </div>
        ` : ''}
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">This is an automated operational system message. Please do not reply directly to this mail.</p>
      </div>
    </div>
  `;
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
 * EMAIL WRAPPER: Prevents application crash loops if Gmail rejection flags trip
 */
const attemptEmailSend = async (mailOptions) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📩 Email sent via Gmail: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ GMAIL SERVICE ERROR:", error.message);
    console.log("Proceeding gracefully without throwing process error to:", mailOptions.to);
    return null;
  }
};

/**
 * SPECIALIZED TRANSACTIONAL TEMPLATES
 */

// 1. Low Stock Alert
const sendLowStockAlert = async ({ io, vendorEmail, userId, product }) => {
  const title = "⚠️ Low Stock Alert";
  const message = `Product "${product.name}" is dropping below standard capacity bounds (${product.stock} items remaining). Update stock listings immediately to retain buyer traffic metrics.`;
  
  await createNotification({ io, userId, title, message, type: 'warning' });

  await attemptEmailSend({
    from: `"NextCart Inventory" <${process.env.EMAIL_USER}>`,
    to: vendorEmail,
    subject: title,
    html: generateEmailTemplate(title, message, "Restock Inventory", `${process.env.FRONTEND_URL}/vendor/inventory`)
  });
};

// 2. Order Status Update (Notify Customer)
const sendOrderStatusNotification = async ({ io, userEmail, userId, orderId, status }) => {
  const title = `📦 Order ${status.toUpperCase()}`;
  const message = `Great news! Your package milestone signature tracker has advanced. Your order #${orderId.toString().slice(-6)} has transitioned status to: ${status}.`;
  
  await createNotification({ io, userId, title, message, type: 'success' });

  await attemptEmailSend({
    from: `"NextCart Orders" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: title,
    html: generateEmailTemplate(title, message, "View Order Tracking", `${process.env.FRONTEND_URL}/orders/${orderId}`)
  });
};

// 3. New Order Received (Notify Vendor)
const sendNewOrderNotification = async ({ io, vendorEmail, userId, orderId }) => {
  const title = "💰 New Order Received!";
  const message = `An item matching your inventory distribution pipeline was successfully purchased! Order target reference sequence: #${orderId.toString().slice(-6)}. Open the fulfillment workspace for routing details.`;

  await createNotification({ io, userId, title, message, type: 'success' });

  await attemptEmailSend({
    from: `"NextCart Sales" <${process.env.EMAIL_USER}>`,
    to: vendorEmail,
    subject: title,
    html: generateEmailTemplate(title, message, "Fulfill Order Now", `${process.env.FRONTEND_URL}/vendor/dashboard`)
  });
};

// 4. Security Alert (New Login)
const sendSecurityAlert = async ({ io, userEmail, userId }) => {
  const title = "🔒 New Login Detected";
  const message = `Security validation warning: An active session initialization protocol handshake occurred on your user registry at ${new Date().toLocaleString()}. If this wasn't you, reset credentials instantly.`;

  await createNotification({ io, userId, title, message, type: 'alert' });

  await attemptEmailSend({
    from: `"NextCart Security" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: title,
    html: generateEmailTemplate(title, message, "Secure My Profile", `${process.env.FRONTEND_URL}/settings/security`)
  });
};

// 5. Vendor Rank Update
const sendVendorRankNotification = async ({ io, vendorEmail, userId, newRank }) => {
  const title = "🌟 Level Up! Your Rank Updated";
  const message = `Congratulations! Based on your sustained trust score evaluations and delivery execution metrics, your core vendor baseline has officially scaled to: **${newRank}**.`;

  await createNotification({ 
    io, 
    userId, 
    title, 
    message, 
    type: 'success', 
    metadata: { rank: newRank } 
  });

  await attemptEmailSend({
    from: `"NextCart Partners" <${process.env.EMAIL_USER}>`,
    to: vendorEmail,
    subject: title,
    html: generateEmailTemplate(title, message, "Review New Tier Benefits", `${process.env.FRONTEND_URL}/vendor/reputation`)
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
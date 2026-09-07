const nodemailer = require('nodemailer');

// ─── Transporter (add your SMTP credentials to .env) ─────────────────────────
const transporter = nodemailer.createTransport({
  host:    process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:    parseInt(process.env.SMTP_PORT) || 587,
  secure:  process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

// ─── Base HTML wrapper ────────────────────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>GebeyaPlus</title>
  <style>
    body { margin:0; padding:0; background:#F3F5F1; font-family:'Segoe UI',Arial,sans-serif; }
    .wrap  { max-width:560px; margin:32px auto; background:#fff; border-radius:16px;
             border:1px solid #e8ede9; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.06); }
    .header{ background:#0E2A23; padding:28px 32px; display:flex; align-items:center; gap:12px; }
    .logo  { font-size:22px; font-weight:800; color:#fff; letter-spacing:-.3px; }
    .logo span { color:#C6A84B; }
    .body  { padding:32px; }
    .title { font-size:20px; font-weight:700; color:#1a2b1f; margin:0 0 8px; }
    .sub   { font-size:14px; color:#7a8c7e; margin:0 0 24px; line-height:1.6; }
    .card  { background:#f8fafb; border:1px solid #e8ede9; border-radius:12px;
             padding:20px 24px; margin:16px 0; }
    .row   { display:flex; justify-content:space-between; font-size:13px;
             padding:6px 0; border-bottom:1px solid #e8ede9; }
    .row:last-child { border-bottom:none; }
    .row .label { color:#7a8c7e; }
    .row .value { font-weight:600; color:#1a2b1f; }
    .total { display:flex; justify-content:space-between; font-size:16px;
             font-weight:800; color:#1a2b1f; padding:14px 0 0; }
    .btn   { display:block; background:#0E2A23; color:#C6A84B !important;
             text-decoration:none; font-weight:700; font-size:14px;
             padding:14px 28px; border-radius:10px; text-align:center;
             margin:24px 0 0; letter-spacing:.03em; }
    .status-badge { display:inline-block; padding:4px 12px; border-radius:20px;
                    font-size:12px; font-weight:700; text-transform:uppercase;
                    letter-spacing:.05em; }
    .footer { padding:20px 32px; background:#f8fafb; border-top:1px solid #e8ede9;
              font-size:11px; color:#7a8c7e; text-align:center; line-height:1.7; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">Next<span>Cart</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,.4);margin-left:auto;
                  text-transform:uppercase;letter-spacing:.15em;">BiT 2026</div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © 2026 GebeyaPlus BiT · Bahir Dar, Ethiopia<br/>
      This is an automated message — please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;

// ─── Status badge helper ──────────────────────────────────────────────────────
const statusBadge = (status) => {
  const map = {
    pending:    { bg:'#faeeda', color:'#854F0B' },
    processing: { bg:'#e6f1fb', color:'#185FA5' },
    shipped:    { bg:'#edf6ff', color:'#0c5a9e' },
    delivered:  { bg:'#eaf3de', color:'#3B6D11' },
    cancelled:  { bg:'#fcebeb', color:'#A32D2D' },
  };
  const s = map[status?.toLowerCase()] || { bg:'#f1f5f9', color:'#64748b' };
  return `<span class="status-badge" style="background:${s.bg};color:${s.color}">${status}</span>`;
};

// ─── Send helper ──────────────────────────────────────────────────────────────
const send = async ({ to, subject, html }) => {
  try {
    const fromUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const info = await transporter.sendMail({
      from: `"GebeyaPlus" <${fromUser}>`,
      to, 
      subject, 
      html,
    });
    console.log(`📧 Email sent → ${to} [${subject}]`);
    return info;
  } catch (err) {
    console.error(`❌ Email failed → ${to}:`, err.message);
    // Gracefully return null so main execution chain doesn't break
    return null;
  }
};

// ─── Generic sendEmail Export ─────────────────────────────────────────────────
const sendEmail = async (options) => {
  const { email, to, subject, message, html } = options;
  const targetEmail = email || to;

  const content = html || `
    <h2 class="title">${subject}</h2>
    <p class="sub">${message}</p>
  `;

  return await send({
    to: targetEmail,
    subject: subject || 'GebeyaPlus Notification',
    html: baseTemplate(content)
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PASSWORD RESET EMAIL (authService)
// ═══════════════════════════════════════════════════════════════════════════════
const sendPasswordResetEmail = async (user, resetUrl) => {
  const html = baseTemplate(`
    <h2 class="title">Password Reset Request 🔐</h2>
    <p class="sub">Hi ${user.name || 'User'}, we received a request to reset your password.</p>
    <p class="sub">Click the button below to complete the reset. This link is valid for a limited time.</p>

    <a href="${resetUrl}" class="btn">
      Reset Password →
    </a>

    <p style="font-size:12px; color:#7a8c7e; margin-top:20px;">
      If you did not request a password reset, please ignore this email.
    </p>
  `);

  return await send({
    to: user.email,
    subject: '🔑 Reset Your GebeyaPlus Password',
    html,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ORDER CONFIRMATION  (customer)
// ═══════════════════════════════════════════════════════════════════════════════
const sendOrderConfirmation = async (order, user) => {
  const itemsHtml = (order.orderItems || []).map(item => `
    <div class="row">
      <span class="label">${item.name} × ${item.quantity}</span>
      <span class="value">$${(item.price * item.quantity).toFixed(2)}</span>
    </div>`).join('');

  const html = baseTemplate(`
    <h2 class="title">Order Confirmed! 🎉</h2>
    <p class="sub">Hi ${user.name || 'Customer'}, your order has been placed successfully
       and is being processed.</p>

    <div class="card">
      <div style="font-size:11px;font-weight:700;color:#7a8c7e;
                  text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">
        Order #${order._id.toString().slice(-8).toUpperCase()}
      </div>
      ${itemsHtml}
      <div class="total">
        <span>Total</span>
        <span style="color:#1D9E75;">$${order.totalPrice.toFixed(2)}</span>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div style="font-size:11px;font-weight:700;color:#7a8c7e;
                  text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">
        Shipping Details
      </div>
      <div class="row"><span class="label">Address</span>
        <span class="value">${order.shippingAddress?.address || '—'}</span></div>
      <div class="row"><span class="label">City</span>
        <span class="value">${order.shippingAddress?.city || '—'}</span></div>
      <div class="row"><span class="label">Payment</span>
        <span class="value">${order.paymentMethod}</span></div>
      <div class="row"><span class="label">Status</span>
        <span class="value">${statusBadge('pending')}</span></div>
    </div>

    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer" class="btn">
      Track Your Order →
    </a>
  `);

  await send({
    to:      user.email,
    subject: `✅ Order Confirmed — #${order._id.toString().slice(-8).toUpperCase()}`,
    html,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ORDER STATUS UPDATE  (customer)
// ═══════════════════════════════════════════════════════════════════════════════
const sendOrderStatusUpdate = async (order, user, newStatus) => {
  const statusMessages = {
    processing: { emoji:'⚙️', msg:'Your order is now being processed by the vendor.' },
    shipped:    { emoji:'🚚', msg:'Great news! Your order is on its way to you.' },
    delivered:  { emoji:'✅', msg:'Your order has been delivered. Enjoy your purchase!' },
    cancelled:  { emoji:'❌', msg:'Unfortunately, your order has been cancelled.' },
  };
  const sm = statusMessages[newStatus] || { emoji:'📦', msg:`Your order status has been updated.` };

  const html = baseTemplate(`
    <h2 class="title">${sm.emoji} Order ${newStatus.charAt(0).toUpperCase()+newStatus.slice(1)}</h2>
    <p class="sub">Hi ${user.name || 'Customer'}, ${sm.msg}</p>

    <div class="card">
      <div class="row">
        <span class="label">Order ID</span>
        <span class="value">#${order._id.toString().slice(-8).toUpperCase()}</span>
      </div>
      <div class="row">
        <span class="label">New Status</span>
        <span class="value">${statusBadge(newStatus)}</span>
      </div>
      <div class="row">
        <span class="label">Total</span>
        <span class="value" style="color:#1D9E75;">$${order.totalPrice.toFixed(2)}</span>
      </div>
      <div class="row">
        <span class="label">Updated</span>
        <span class="value">${new Date().toLocaleDateString('en-US',
          { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
      </div>
    </div>

    ${newStatus === 'delivered' ? `
    <div class="card" style="background:#eaf3de;border-color:#c3ddb5;margin-top:12px;">
      <p style="margin:0;font-size:13px;color:#3B6D11;font-weight:600;">
        ⭐ Enjoyed your order? Leave a review to help other shoppers!
      </p>
    </div>` : ''}

    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer" class="btn">
      View Order Details →
    </a>
  `);

  await send({
    to:      user.email,
    subject: `${sm.emoji} Order Update — ${newStatus.toUpperCase()} #${order._id.toString().slice(-8).toUpperCase()}`,
    html,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. VENDOR PAYOUT CONFIRMATION  (vendor)
// ═══════════════════════════════════════════════════════════════════════════════
const sendVendorPayoutConfirmation = async (vendor, user, amount, method, txId) => {
  const html = baseTemplate(`
    <h2 class="title">💰 Payout Initiated</h2>
    <p class="sub">Hi ${user.name || vendor.businessName}, your withdrawal request
       has been received and is being processed.</p>

    <div class="card">
      <div style="font-size:11px;font-weight:700;color:#7a8c7e;
                  text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">
        Payout Summary
      </div>
      <div class="row">
        <span class="label">Amount</span>
        <span class="value" style="color:#1D9E75;font-size:18px;">
          ${amount.toLocaleString()} ETB
        </span>
      </div>
      <div class="row">
        <span class="label">Method</span>
        <span class="value" style="text-transform:capitalize;">${method}</span>
      </div>
      ${txId ? `<div class="row">
        <span class="label">Transaction ID</span>
        <span class="value" style="font-family:monospace;">${txId}</span>
      </div>` : ''}
      <div class="row">
        <span class="label">Status</span>
        <span class="value">${statusBadge('processing')}</span>
      </div>
      <div class="row">
        <span class="label">Expected</span>
        <span class="value">1–3 business days</span>
      </div>
    </div>

    <div class="card" style="background:#faeeda;border-color:#f0d099;margin-top:12px;">
      <p style="margin:0;font-size:13px;color:#854F0B;">
        ⏳ Funds will be transferred to your ${method} account within 1–3 business days.
           If you have any issues, contact support.
      </p>
    </div>

    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor/wallet" class="btn">
      View Wallet →
    </a>
  `);

  await send({
    to:      user.email,
    subject: `💰 Payout of ${amount.toLocaleString()} ETB Initiated — GebeyaPlus`,
    html,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. WELCOME EMAIL  (new user registration)
// ═══════════════════════════════════════════════════════════════════════════════
const sendWelcomeEmail = async (user) => {
  const html = baseTemplate(`
    <h2 class="title">Welcome to GebeyaPlus! 🎉</h2>
    <p class="sub">Hi ${user.name || 'there'}, your account has been created successfully.
       Start exploring products from trusted vendors near you.</p>

    <div class="card">
      <div class="row"><span class="label">Name</span>
        <span class="value">${user.name}</span></div>
      <div class="row"><span class="label">Email</span>
        <span class="value">${user.email}</span></div>
      <div class="row"><span class="label">Role</span>
        <span class="value" style="text-transform:capitalize;">${user.role}</span></div>
    </div>

    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="btn">
      Start Shopping →
    </a>
  `);

  await send({
    to:      user.email,
    subject: `🎉 Welcome to GebeyaPlus, ${user.name}!`,
    html,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. NEW ORDER ALERT  (vendor)
// ═══════════════════════════════════════════════════════════════════════════════
const sendVendorNewOrderAlert = async (vendor, user, order) => {
  const myItems = (order.orderItems || []).filter(i =>
    i.vendor?.toString() === vendor._id?.toString() ||
    i.vendor?.toString() === vendor.user?.toString()
  );

  const itemsHtml = myItems.map(item => `
    <div class="row">
      <span class="label">${item.name} × ${item.quantity}</span>
      <span class="value">$${(item.price * item.quantity).toFixed(2)}</span>
    </div>`).join('');

  const html = baseTemplate(`
    <h2 class="title">🛒 New Order Received!</h2>
    <p class="sub">Hi ${user.name || vendor.businessName}, you have a new order
       that needs your attention.</p>

    <div class="card">
      <div style="font-size:11px;font-weight:700;color:#7a8c7e;
                  text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">
        Order #${order._id.toString().slice(-8).toUpperCase()}
      </div>
      ${itemsHtml || '<div class="row"><span class="label">Items from your store</span></div>'}
    </div>

    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor/orders" class="btn">
      Manage Order →
    </a>
  `);

  await send({
    to:      user.email,
    subject: `🛒 New Order #${order._id.toString().slice(-8).toUpperCase()} — Action Required`,
    html,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendVendorPayoutConfirmation,
  sendWelcomeEmail,
  sendVendorNewOrderAlert
};
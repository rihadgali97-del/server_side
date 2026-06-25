const nodemailer = require('nodemailer');

/**
 * UNIVERSAL EMAIL ENGINE (Gmail & UI Optimized)
 */
const sendEmail = async (options) => {
  // 1. Safe Gmail Transporter Initialization
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 2. Auto-detect any fallback URLs inside the message text to generate buttons dynamically
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const detectedUrl = options.message ? options.message.match(urlRegex)?.[0] : null;
  const targetUrl = options.resetUrl || detectedUrl;

  // 3. Determine branding themes dynamically based on email intent
  const isPasswordReset = options.subject.toLowerCase().includes('password');
  const isVerification = options.subject.toLowerCase().includes('verify');
  
  let brandColor = '#4f46e5'; // Primary Indigo
  let buttonLabel = 'Proceed to Action';
  let cleanMessage = options.message || '';

  if (isPasswordReset) {
    brandColor = '#dc2626'; // Security Red
    buttonLabel = 'Reset My Password';
  } else if (isVerification) {
    brandColor = '#10b981'; // Success Green
    buttonLabel = 'Verify My Account';
  }

  // Remove the raw link from the text layout if we're converting it into an HTML button
  if (targetUrl) {
    cleanMessage = cleanMessage.replace(targetUrl, '');
  }

  // 4. Construct a Responsive Production Email Wrapper
  const emailHtml = `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9; margin-bottom: 24px;">
        <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">NextCart Platforms</h2>
      </div>
      
      <div style="color: #334155; font-size: 15px; line-height: 1.6;">
        <h3 style="color: #1e293b; margin-top: 0; font-size: 18px; font-weight: 600;">${options.subject}</h3>
        <p style="white-space: pre-line; color: #475569;">${cleanMessage.trim()}</p>
        
        ${targetUrl ? `
          <div style="text-align: center; margin: 32px 0;">
            <a href="${targetUrl}" style="background-color: ${brandColor}; color: #ffffff; padding: 13px 26px; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              ${buttonLabel}
            </a>
          </div>
        ` : ''}
        
        <p style="font-size: 13px; color: #64748b; background-color: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #cbd5e1; margin-top: 24px;">
          <strong>Operational Notice:</strong> This is an encrypted transaction pipeline handshake. If you did not trigger this request, please disregard this system notification safely.
        </p>
      </div>
      
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
        <p style="margin: 0;">NextCart Infrastructure Layer &copy; 2026</p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"NextCart Operations" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message, // Structural text fallback for legacy mail clients
    html: emailHtml
  };

  // 5. Execute Delivery Handshake
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📩 [GMAIL SUCCESS] Transactional dispatch authorized: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ [EMAIL CRASH PREVENTED] System engine failure:", error.message);
    // Throwing here allows AuthService to catch the event and cleanly rollback open DB states
    throw new Error(`SMTP Handshake execution rejected: ${error.message}`);
  }
};

module.exports = sendEmail;
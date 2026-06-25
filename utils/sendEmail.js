const nodemailer = require('nodemailer');

/**
 * STANDALONE EMAIL UTILITY (Gmail Optimized)
 */
const sendEmail = async (options) => {
  // 1. Unified Gmail Transporter Connection
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 2. Check if this is a Password Reset request to serve a clean button template
  let emailHtml = options.html;
  
  if (!emailHtml && options.subject.toLowerCase().includes('password')) {
    emailHtml = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 700;">NextCart Account Security</h2>
        </div>
        <div style="color: #334155; font-size: 15px; line-height: 1.6;">
          <p>Hello,</p>
          <p>We received a request to reset the password associated with your NextCart account credentials. Click the button below to initialize your security override and configure a new password:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${options.resetUrl || '#'}" style="background-color: #dc2626; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);">
              Reset My Password
            </a>
          </div>
          
          <p style="font-size: 13px; color: #64748b; background-color: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #cbd5e1;">
            <strong>Security Notice:</strong> This secure authentication loop expires in 10 minutes. If you did not initiate this system operation, please ignore this email or reach out to support if you suspect unauthorized access.
          </p>
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0;">NextCart Infrastructure Layer &copy; 2026</p>
        </div>
      </div>
    `;
  }

  // 3. Fallback to basic configuration if no specialized HTML is provided
  const mailOptions = {
    from: `"NextCart Security" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message, // Plain text fallback for legacy clients
    html: emailHtml
  };

  // 4. Fire the email safely without breaking the parent process
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`🔒 Security email dispatched via Gmail: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ STANDALONE EMAIL UTILITY ERROR:", error.message);
    throw new Error(`Email delivery protocol failed: ${error.message}`);
  }
};

module.exports = sendEmail;
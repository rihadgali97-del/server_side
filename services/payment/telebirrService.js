const crypto = require('crypto');

class TelebirrService {
  constructor() {
    this.appId = process.env.TELEBIRR_APP_ID;
    this.appKey = process.env.TELEBIRR_APP_KEY;
    this.shortCode = process.env.TELEBIRR_SHORT_CODE;
    this.apiUrl = process.env.TELEBIRR_API_URL || "https://pay.telebirr.et/hk-gateway/payment";
  }

  // 1. Sort fields alphabetically and generate SHA256 Signature
  generateSignature(payload) {
    const sortedKeys = Object.keys(payload).sort();
    const signString = sortedKeys
      .map(key => `${key}=${payload[key]}`)
      .join('&');
    
    return crypto.createHash('sha256').update(signString).digest('hex');
  }

  // 2. Encrypt parameters using AES-128-CBC with hex-parsed AppKey buffers
  encryptData(data) {
    try {
      const plainText = JSON.stringify(data);
      
      // FIX: Parse the 32-character hex AppKey into a 16-byte binary buffer
      const keyAndIv = Buffer.from(this.appKey, 'hex'); 
      
      const cipher = crypto.createCipheriv('aes-128-cbc', keyAndIv, keyAndIv);
      let encrypted = cipher.update(plainText, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      return encrypted;
    } catch (error) {
      console.error("❌ Telebirr Encryption Error:", error.message);
      throw new Error("Encryption failed: " + error.message);
    }
  }

  // 3. Decrypt incoming message text from webhooks using AES-128-CBC
  async decryptNotifyData(encryptedData) {
    try {
      if (!encryptedData) return null;
      if (typeof encryptedData === 'object') return encryptedData;

      // FIX: Parse the 32-character hex AppKey into a 16-byte binary buffer
      const keyAndIv = Buffer.from(this.appKey, 'hex');
      const decipher = crypto.createDecipheriv('aes-128-cbc', keyAndIv, keyAndIv);
      
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error("❌ Telebirr Decryption Error:", error.message);
      return null;
    }
  }

  // 4. Build web redirection string link package
  async createTelebirrOrder(order) {
    const payload = {
      appId: this.appId,
      nonce: crypto.randomBytes(16).toString('hex'),
      notifyUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/telebirr-webhook`,
      outTradeNo: order._id.toString(),
      receiverName: "NextCart",
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order-success/${order._id}`,
      shortCode: this.shortCode,
      subject: "NextCart Order Payment",
      timeoutExpress: "30",
      timestamp: Date.now().toString(),
      totalAmount: order.totalPrice.toString()
    };

    const signature = this.generateSignature(payload);
    const encryptedData = this.encryptData(payload);

    return {
      paymentUrl: `${this.apiUrl}?appid=${this.appId}&sign=${signature}&ussd=${encodeURIComponent(encryptedData)}`
    };
  }
}

module.exports = new TelebirrService();
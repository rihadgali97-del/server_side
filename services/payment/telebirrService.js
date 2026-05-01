const NodeRSA = require('node-rsa');
const crypto = require('crypto');

class TelebirrService {
  constructor() {
    this.appId = process.env.TELEBIRR_APP_ID;
    this.appKey = process.env.TELEBIRR_APP_KEY;
    this.shortCode = process.env.TELEBIRR_SHORT_CODE;
    this.apiUrl = process.env.TELEBIRR_API_URL;
    
    // FIX: Replace literal "\n" strings with actual newline characters
    const rawKey = process.env.TELEBIRR_PUBLIC_KEY || "";
    this.publicKey = rawKey.replace(/\\n/g, '\n');
  }

  // 1. Sort and Sign the request (SHA256 with AppKey)
  generateSignature(payload) {
    const sortedKeys = Object.keys(payload).sort();
    const signString = sortedKeys
      .map(key => `${key}=${payload[key]}`)
      .join('&') + `&key=${this.appKey}`;
    
    return crypto.createHash('sha256').update(signString).digest('hex');
  }

  // 2. Encrypt the data with Telebirr Public Key (RSA PKCS1)
  encryptData(data) {
    try {
      if (!this.publicKey || this.publicKey.length < 10) {
        throw new Error("TELEBIRR_PUBLIC_KEY is invalid or missing in .env");
      }

      const rsa = new NodeRSA(this.publicKey, 'public', {
        encryptionScheme: 'pkcs1'
      });
      
      return rsa.encrypt(JSON.stringify(data), 'base64');
    } catch (error) {
      console.error("RSA Encryption Error Detail:", error.message);
      throw new Error("Encryption failed: " + error.message);
    }
  }

  // 3. Decrypt the NotifyData from Telebirr Webhook
  async decryptNotifyData(encryptedData) {
    try {
      // Handle cases where the data might already be an object (testing)
      if (typeof encryptedData === 'object') return encryptedData;

      const rsa = new NodeRSA(this.publicKey, 'public', {
        encryptionScheme: 'pkcs1'
      });
      
      const decrypted = rsa.decrypt(encryptedData, 'utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error("RSA Decryption Error:", error.message);
      return null;
    }
  }

  // 4. Create the final request package
  async createTelebirrOrder(order) {
    const payload = {
      appId: this.appId,
      outTradeNo: order._id.toString(), // The 24-char ID Mongoose likes
      receiverName: "NextCart",
      shortCode: this.shortCode,
      subject: "Order Payment",
      totalAmount: order.totalPrice.toString(),
      timeoutExpress: "30",
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now().toString(),
      returnUrl: `${process.env.FRONTEND_URL}/order-success/${order._id}`,
      notifyUrl: `${process.env.BACKEND_URL}/api/payments/telebirr-webhook`
    };

    const signature = this.generateSignature(payload);
    const encryptedData = this.encryptData(payload);

    return {
      paymentUrl: `${this.apiUrl}?appid=${this.appId}&sign=${signature}&ussd=${encryptedData}`
    };
  }
}

module.exports = new TelebirrService();
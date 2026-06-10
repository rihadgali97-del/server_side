const crypto = require('crypto');
const axios = require('axios');

class TelebirrService {
  constructor() {
    this.merchantAppId = process.env.TELEBIRR_MERCHANT_APP_ID;
    this.appId         = process.env.TELEBIRR_FABRIC_APP_ID;
    this.appSecret     = process.env.TELEBIRR_APP_SECRET;
    this.shortCode     = process.env.TELEBIRR_SHORT_CODE;
    this.baseUrl       = process.env.TELEBIRR_BASE_URL || 'https://preupay.telebirr.et/toTradeWebPay';
  }

  /**
   * Formats the multi-line structural RSA Private Key cleanly.
   * Converts any escaped string literals to actual newlines for the Node crypto module.
   */
  getPrivateKey() {
    const rawKey = process.env.TELEBIRR_PRIVATE_KEY || '';
    if (rawKey.includes('-----BEGIN PRIVATE KEY-----')) {
      return rawKey.replace(/\\n/g, '\n');
    }
    const clean = rawKey.replace(/\s/g, '');
    return `-----BEGIN PRIVATE KEY-----\n${clean.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
  }

  /**
   * Formats payload into string query parameters sorted alphabetically by key
   * to construct a signed hash string matching Telebirr's security architecture.
   */
  generateFabricSignature(payload) {
    try {
      const filteredKeys = Object.keys(payload)
        .filter(key => key !== 'sign' && payload[key] !== undefined && payload[key] !== '')
        .sort();

      const signString = filteredKeys
        .map(key => {
          const val = typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : payload[key];
          return `${key}=${val}`;
        })
        .join('&');

      const sign = crypto.createSign('SHA256');
      sign.update(signString);
      return sign.sign(this.getPrivateKey(), 'base64');
    } catch (error) {
      console.error('❌ Fabric Cryptographic Signing Exception:', error.message);
      throw error;
    }
  }

  /**
   * Order creation processor logic.
   * Leverages a local sandbox simulator fallback environment whenever NODE_ENV equals 'development'.
   */
  async createTelebirrOrder(order) {
    // ── LOCAL / SANDBOX SIMULATOR BYPASS ──
    // Keep this active while working on your local machine without a VPN!
    if (process.env.NODE_ENV === 'development') {
      console.warn('🚀 [DEV] Telebirr simulator active — returning sandbox checkout URL.');
      const sandboxUrl =
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/telebirr-pay` +
        `?orderId=${order._id}` +
        `&amount=${Number(order.totalPrice).toFixed(2)}`;

      return { success: true, url: sandboxUrl };
    }

    // Live Fabric H5 Integration Architecture (Runs when deployed or over a working network/VPN)
    try {
      const rawRequestPayload = {
        appid: this.appId,
        merch_order_id: order._id.toString(),
        merchant_app_id: this.merchantAppId,
        mid: this.shortCode,
        notify_url: `${process.env.BACKEND_URL}/api/payments/telebirr-webhook`,
        return_url: `${process.env.FRONTEND_URL}/payment-success`,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        total_amount: Number(order.totalPrice).toFixed(2).toString(),
        title: "NextCart Purchase"
      };

      const rsaSignature = this.generateFabricSignature(rawRequestPayload);

      const finalRequestBody = {
        ...rawRequestPayload,
        sign: rsaSignature,
        sign_type: "SHA256WithRSA"
      };

      console.log('📡 Dispatching live pre-order authentication to Telebirr API...');

      const response = await axios.post(this.baseUrl, finalRequestBody, {
        headers: {
          'Content-Type': 'application/json',
          'X-APP-Secret': this.appSecret
        }
      });

      const toPayUrl = response.data?.biz_content?.toPayUrl || response.data?.toPayUrl;
      if (!toPayUrl) {
        throw new Error(response.data?.msg || 'Fabric gateway did not return a valid URL');
      }

      return { success: true, url: toPayUrl };
    } catch (error) {
      console.error('❌ Fabric Preorder Node Failure:', error.response?.data || error.message);
      throw new Error('Telebirr checkout initialization failed: ' + error.message);
    }
  }

  /**
   * Decrypts and parses inbound callback parameters transmitted by Telebirr webhooks.
   */
  decryptNotifyData(encryptedMsgTxt) {
    try {
      const raw = Buffer.from(encryptedMsgTxt, 'base64').toString('utf8');
      try {
        return JSON.parse(raw);
      } catch {
        const aesKey = Buffer.from(this.appSecret.slice(0, 32).padEnd(32, '0'), 'utf8');
        const iv     = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
        decipher.setAutoPadding(true);
        const decrypted = Buffer.concat([
          decipher.update(Buffer.from(encryptedMsgTxt, 'base64')),
          decipher.final()
        ]).toString('utf8');
        return JSON.parse(decrypted);
      }
    } catch (error) {
      console.error('❌ Webhook decryption failed:', error.message);
      throw new Error('Failed to decrypt Telebirr notify payload: ' + error.message);
    }
  }
}

module.exports = new TelebirrService();
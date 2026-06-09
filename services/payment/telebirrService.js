const crypto = require('crypto');
const axios = require('axios');

class TelebirrService {
  constructor() {
    this.appId      = process.env.TELEBIRR_APP_ID;
    this.appKey     = process.env.TELEBIRR_APP_KEY;
    this.shortCode  = process.env.TELEBIRR_SHORT_CODE;
    this.tokenUrl   = process.env.TELEBIRR_TOKEN_URL  || 'https://pay.telebirr.et/payment/v1/token';
    this.prepayUrl  = process.env.TELEBIRR_PREPAY_URL || 'https://pay.telebirr.et/payment/v1/applyFabricToken';
    // Telebirr's PUBLIC key is used to decrypt/verify their webhook callbacks
    this.telebirrPublicKey = process.env.TELEBIRR_PUBLIC_KEY || '';
  }

  // ─── Private key formatter ────────────────────────────────────────────────
  // Handles both pre-formatted keys (with \n) and raw base64 blobs from .env
  getPrivateKey() {
    const rawKey = process.env.TELEBIRR_PRIVATE_KEY || '';
    if (rawKey.includes('-----BEGIN PRIVATE KEY-----')) {
      return rawKey.replace(/\\n/g, '\n');
    }
    const clean = rawKey.replace(/\s/g, '');
    return `-----BEGIN PRIVATE KEY-----\n${clean.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
  }

  // ─── RSA sign ─────────────────────────────────────────────────────────────
  generateFabricSignature(dataString) {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(dataString);
      return sign.sign(this.getPrivateKey(), 'base64');
    } catch (error) {
      console.error('❌ Fabric Signing Error:', error.message);
      throw error;
    }
  }

  // ─── Step 1: fetch auth token from Fabric Gateway ─────────────────────────
  async getFabricToken() {
    try {
      const response = await axios.post(this.tokenUrl, {
        appId:  this.appId,
        appKey: this.appKey   // Fabric token endpoint uses appKey, not appSecret
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const token = response.data?.biz_content?.token;
      if (!token) {
        throw new Error(response.data?.msg || 'Failed to retrieve Fabric access token');
      }
      return token;
    } catch (error) {
      console.error('❌ Telebirr Token Fetch Failed:', error.response?.data || error.message);
      throw new Error('Fabric auth failure: ' + error.message);
    }
  }

  // ─── Step 2: create order — simulator in dev, real Fabric in production ───
  async createTelebirrOrder(order) {
    // ── LOCAL / SANDBOX SIMULATOR ──────────────────────────────────────────
    // Only runs when NODE_ENV is explicitly 'development'.
    // In production this block is skipped entirely and the real Fabric API is called.
    if (process.env.NODE_ENV === 'development') {
      console.warn('🚀 [DEV] Telebirr simulator active — returning sandbox checkout URL.');

      const sandboxUrl =
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/telebirr-sandbox-checkout` +
        `?orderId=${order._id}` +
        `&amount=${Number(order.totalPrice).toFixed(2)}` +
        `&notifyUrl=${encodeURIComponent(
          (process.env.BACKEND_URL || 'http://localhost:5000') +
          '/api/payments/telebirr-webhook'
        )}`;

      return { success: true, url: sandboxUrl };
    }

    // ── LIVE FABRIC H5 FLOW ────────────────────────────────────────────────
    try {
      const authToken = await this.getFabricToken();

      const bizContent = {
        out_trade_no:    order._id.toString(),
        subject:         'NextCart Purchase',
        total_amount:    Number(order.totalPrice).toFixed(2).toString(),
        currency:        'ETB',
        timeout_express: '30m',
        short_code:      this.shortCode,
        notify_url:      `${process.env.BACKEND_URL}/api/payments/telebirr-webhook`,
        return_url:      `${process.env.FRONTEND_URL}/order-success/${order._id}`,
        trade_type:      'H5'
      };

      const payload = {
        nonce_str:   crypto.randomBytes(16).toString('hex'),
        method:      'payment.preorder',
        timestamp:   Math.floor(Date.now() / 1000).toString(),
        version:     '1.0',
        biz_content: bizContent
      };

      // Fabric expects only the biz_content object to be signed
      const rsaSignature = this.generateFabricSignature(JSON.stringify(bizContent));

      const response = await axios.post(this.prepayUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-APP-ID':    this.appId,
          'X-SIGNATURE': rsaSignature,
          'X-TOKEN':     authToken
        }
      });

      const toPayUrl = response.data?.biz_content?.toPayUrl;
      if (!toPayUrl) {
        throw new Error(response.data?.msg || 'Fabric gateway did not return a payment URL');
      }

      return { success: true, url: toPayUrl };
    } catch (error) {
      console.error('❌ Fabric Preorder Failure:', error.response?.data || error.message);
      throw new Error('Telebirr checkout initialization failed: ' + error.message);
    }
  }

  // ─── Webhook decryption ───────────────────────────────────────────────────
  // Telebirr encrypts the notify payload with their private key (RSA + AES combo).
  // The msgtxt field is a Base64-encoded AES-encrypted JSON blob; the AES key
  // itself is RSA-encrypted with your PUBLIC key so only you can decrypt it.
  //
  // Standard Fabric notify structure:
  //   msgtxt  = Base64( AES_CBC_encrypt( JSON(bizContent), aesKey, iv ) )
  //   sign    = Base64( RSA_sign( msgtxt, telebirrPrivateKey ) )  ← optional verify
  //
  // If Telebirr sends plain JSON instead (sandbox mode), this falls through
  // gracefully — the controller checks for msgtxt before calling this method.
  decryptNotifyData(encryptedMsgTxt) {
    try {
      // Some Fabric sandbox setups skip encryption and send raw base64 JSON
      const raw = Buffer.from(encryptedMsgTxt, 'base64').toString('utf8');
      try {
        return JSON.parse(raw);
      } catch {
        // Not plain JSON — attempt AES decryption using appKey as the symmetric key.
        // Production Fabric: replace with your actual AES key derivation if different.
        const aesKey = Buffer.from(this.appKey.slice(0, 32).padEnd(32, '0'), 'utf8');
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
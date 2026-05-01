const StripeGateway = require('./StripeGateway');
const TelebirrGateway = require('./TelebirrGateway');
const CBEGateway = require('./CBEGateway'); // Placeholder for now

class PaymentFactory {
  getGateway(method) {
    switch (method) {
      case 'stripe':
        return StripeGateway;
      case 'telebirr':
        return TelebirrGateway;
      case 'cbe':
        return CBEGateway;
      default:
        return null; // For Cash on Delivery
    }
  }
}

module.exports = new PaymentFactory();
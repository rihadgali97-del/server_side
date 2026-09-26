const TelebirrGateway = require('./TelebirrGateway');
const CBEGateway = require('./CBEGateway'); // Placeholder for now
const ChapaGateway = require('./ChapaGateway');

class PaymentFactory {
  getGateway(method) {
    switch (method.toLowerCase()) {
      case 'telebirr':
        return TelebirrGateway;
      case 'cbe':
        return CBEGateway;
      case 'chapa':
        return ChapaGateway;
      default:
        return null; // For Cash on Delivery
    }
  }
}

module.exports = new PaymentFactory();

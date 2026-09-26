const chapaService = require('./chapaService');

module.exports = {
  async processPayment(order) {
    try {
      const { txRef, checkoutUrl } = await chapaService.initializeTransaction(order);
      return { success: true, status: 'pending', txRef, checkoutUrl };
    } catch (error) {
      const chapaMessage = error.response?.data?.message;
      return {
        success: false,
        message: typeof chapaMessage === 'string' ? chapaMessage : error.message,
      };
    }
  },
};

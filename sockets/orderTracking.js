module.exports = (io) => {
  // Logic to emit status updates
  const updateOrderStatus = (orderId, customerId, status) => {
    io.to(customerId.toString()).emit('orderUpdate', {
      orderId,
      status,
      message: `Your order #${orderId} is now ${status}!`
    });
  };
  
  return { updateOrderStatus };
};
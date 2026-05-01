const Message = require('../models/Message');

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // User joins a private room based on their ID
    socket.on('join_chat', (userId) => {
      socket.join(userId);
      console.log(`💬 User ${userId} is now online and in their private room`);
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { senderId, receiverId, text } = data;

        // 1. Save message to MongoDB
        const newMessage = await Message.create({
          sender: senderId,
          receiver: receiverId,
          text: text
        });

        console.log(`💾 Message saved from ${senderId} to ${receiverId}`);

        // 2. Emit to the specific receiver's room
        io.to(receiverId).emit('receive_message', newMessage);

        // 3. Emit back to sender to confirm it was sent
        io.to(senderId).emit('message_sent', newMessage);

      } catch (err) {
        console.error("❌ Socket Chat Error:", err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ User left chat');
    });
  });
};
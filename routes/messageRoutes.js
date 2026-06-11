// Get all users who have chatted with the current user
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    // Find unique senders/receivers for the current user
    const conversations = await Message.aggregate([
      { $match: { $or: [{ sender: userId }, { receiver: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", userId] },
              "$receiver",
              "$sender"
            ]
          },
          lastMessage: { $first: "$text" },
          lastTimestamp: { $first: "$createdAt" }
        }
      },
      {
        $lookup: {
          from: 'users', // users collection
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' }
    ]);

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
const notificationService = require('../services/notificationService');

const getNotifications = async (req, res) => {
  try {
    const result = await notificationService.getNotifications({
      userId: req.user.id,
      page: req.query.page,
      limit: req.query.limit,
      read: req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined,
      type: req.query.type
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getNotification = async (req, res) => {
  try {
    const notification = await notificationService.getNotificationById(req.params.id, req.user.id);
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const notification = await notificationService.deleteNotification(req.params.id, req.user.id);
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNotifications,
  getNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
};
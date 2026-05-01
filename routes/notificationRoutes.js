const express = require('express');
const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Notifications
 *   description: Real-time user alerts, vendor rank updates, and system messages
 */

const {
  getNotifications,
  getNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} = require('../controller/notificationController');

const { protect } = require('../middleware/authMiddleware');

// All notification routes require authentication
router.use(protect);

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Retrieve all notifications for the logged-in user
 *     description: Returns a paginated list of alerts, including order updates and vendor rank changes.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: read
 *         description: Filter by read/unread status
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of notifications retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       title: { type: string }
 *                       message: { type: string }
 *                       type: { type: string, enum: [info, success, warning, alert] }
 *                       read: { type: boolean }
 *                       createdAt: { type: string, format: date-time }
 */
router.get('/', getNotifications);

/**
 * @openapi
 * /api/notifications/read-all:
 *   put:
 *     summary: Mark all user notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications updated
 */
router.put('/read-all', markAllNotificationsAsRead);

/**
 * @openapi
 * /api/notifications/{id}:
 *   get:
 *     summary: Get a specific notification by ID
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification details found
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted
 */
router.get('/:id', getNotification);
router.delete('/:id', deleteNotification);

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.put('/:id/read', markNotificationAsRead);

module.exports = router;
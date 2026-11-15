const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

/**
 * GET /api/notifications
 * Fetch logged-in user notifications
 */
router.get('/', async (req, res) => {
  try {
    const notifications = await query(
      'SELECT id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    const [unreadCount] = await query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      notifications,
      unreadCount: unreadCount?.unread || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification read
 */
router.patch('/:id/read', async (req, res) => {
  const notifId = parseInt(req.params.id, 10);
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [notifId, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all user notifications as read
 */
router.post('/mark-all-read', async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

module.exports = router;

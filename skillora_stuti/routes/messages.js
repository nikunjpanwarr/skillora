const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

/**
 * GET /api/messages/order/:orderId
 * Retrieve message thread for a specific order
 */
router.get('/order/:orderId', async (req, res) => {
  const orderId = parseInt(req.params.orderId, 10);
  if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

  try {
    // 1. Verify user access
    const orders = await query('SELECT id, consumer_id, producer_id, order_number FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];
    if (order.consumer_id !== req.user.id && order.producer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to view this conversation' });
    }

    // 2. Mark incoming messages as read
    await query(
      'UPDATE messages SET is_read = TRUE WHERE order_id = ? AND receiver_id = ?',
      [orderId, req.user.id]
    );

    // 3. Fetch chat history
    const sql = `
      SELECT 
        m.id,
        m.order_id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.is_read,
        m.created_at,
        u.name AS sender_name,
        u.department AS sender_dept
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.order_id = ?
      ORDER BY m.created_at ASC
    `;
    const messages = await query(sql, [orderId]);

    res.json({
      order_number: order.order_number,
      partner_id: order.consumer_id === req.user.id ? order.producer_id : order.consumer_id,
      messages
    });
  } catch (err) {
    console.error('Error fetching order messages:', err);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

/**
 * POST /api/messages
 * Send a message within an order
 */
router.post('/', async (req, res) => {
  const { order_id, message } = req.body;
  const orderId = parseInt(order_id, 10);

  if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  try {
    const orders = await query('SELECT id, consumer_id, producer_id, order_number FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];
    if (order.consumer_id !== req.user.id && order.producer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to message in this order' });
    }

    // Target receiver is the other participant
    const receiverId = order.consumer_id === req.user.id ? order.producer_id : order.consumer_id;

    const result = await query(
      `INSERT INTO messages (order_id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)`,
      [orderId, req.user.id, receiverId, message.trim()]
    );

    // Notify receiver
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, 'message', ?)`,
      [
        receiverId,
        `New Message from ${req.user.name}`,
        `"${message.trim().slice(0, 60)}${message.length > 60 ? '...' : ''}" (Order ${order.order_number})`,
        req.user.id === order.consumer_id ? 'producer-dashboard.html?tab=orders' : 'consumer-dashboard.html?tab=orders'
      ]
    );

    res.status(201).json({
      success: true,
      message_id: result.insertId,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;

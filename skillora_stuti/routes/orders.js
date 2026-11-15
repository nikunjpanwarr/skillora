const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

/**
 * Helper: Create in-app notification
 */
async function notify(userId, title, message, type = 'info', link = null) {
  try {
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, link]
    );
  } catch (err) {
    console.warn('Failed to insert notification:', err.message);
  }
}

/**
 * POST /api/orders
 * Create an order for a valid active service
 */
router.post('/', requireAuth, async (req, res) => {
  const { service_id, requirements } = req.body;

  const serviceId = parseInt(service_id, 10);
  if (isNaN(serviceId)) {
    return res.status(400).json({ error: 'Valid service ID is required.' });
  }

  if (!requirements || requirements.trim().length < 5) {
    return res.status(400).json({ error: 'Please describe your requirements (minimum 5 characters).' });
  }

  try {
    // 1. Fetch service details
    const services = await query(
      'SELECT id, title, price, producer_id, status FROM services WHERE id = ?',
      [serviceId]
    );

    if (services.length === 0 || services[0].status !== 'active') {
      return res.status(404).json({ error: 'Service is not currently available for ordering.' });
    }

    const service = services[0];

    // Cannot order own service
    if (service.producer_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot place an order on your own service.' });
    }

    // 2. Generate unique order number (e.g. SKO-492019)
    const orderNumber = 'SKO-' + Math.floor(100000 + Math.random() * 900000);

    // 3. Create order record
    const result = await query(
      `INSERT INTO orders 
        (order_number, service_id, consumer_id, producer_id, status, price, requirements)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [orderNumber, service.id, req.user.id, service.producer_id, service.price, requirements.trim()]
    );

    const orderId = result.insertId;

    // 4. Notify Producer
    await notify(
      service.producer_id,
      'New Order Request',
      `${req.user.name} placed order ${orderNumber} for "${service.title}".`,
      'order_placed',
      `producer-dashboard.html?tab=orders`
    );

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      order: {
        id: orderId,
        order_number: orderNumber,
        service_id: service.id,
        service_title: service.title,
        price: service.price,
        status: 'pending'
      }
    });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Database error occurred while creating order.' });
  }
});

/**
 * GET /api/orders/my-orders
 * List orders placed by the authenticated consumer
 */
router.get('/my-orders', requireAuth, async (req, res) => {
  try {
    const sql = `
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.price,
        o.requirements,
        o.created_at,
        o.updated_at,
        s.id AS service_id,
        s.title AS service_title,
        c.name AS category_name,
        c.icon AS category_icon,
        c.tone AS category_tone,
        u.id AS producer_id,
        u.name AS producer_name,
        u.department AS producer_dept,
        r.id AS review_id,
        r.rating AS review_rating
      FROM orders o
      JOIN services s ON o.service_id = s.id
      JOIN categories c ON s.category_id = c.id
      JOIN users u ON o.producer_id = u.id
      LEFT JOIN reviews r ON o.id = r.order_id
      WHERE o.consumer_id = ?
      ORDER BY o.created_at DESC
    `;

    const orders = await query(sql, [req.user.id]);
    res.json({ orders });
  } catch (err) {
    console.error('Error fetching consumer orders:', err);
    res.status(500).json({ error: 'Failed to retrieve order history.' });
  }
});

/**
 * GET /api/orders/:id
 * Retrieve a single order details
 */
router.get('/:id', requireAuth, async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

  try {
    const sql = `
      SELECT 
        o.*,
        s.title AS service_title,
        s.delivery_time,
        c.name AS category_name,
        u_p.name AS producer_name,
        u_p.email AS producer_email,
        u_c.name AS consumer_name,
        u_c.email AS consumer_email
      FROM orders o
      JOIN services s ON o.service_id = s.id
      JOIN categories c ON s.category_id = c.id
      JOIN users u_p ON o.producer_id = u_p.id
      JOIN users u_c ON o.consumer_id = u_c.id
      WHERE o.id = ?
    `;
    const rows = await query(sql, [orderId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0];

    // Access check: only consumer, producer, or admin
    if (order.consumer_id !== req.user.id && order.producer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this order.' });
    }

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve order' });
  }
});

/**
 * PATCH /api/orders/:id/cancel
 * Consumer can cancel if status is 'pending'
 */
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

  try {
    const rows = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0];
    if (order.consumer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to cancel this order.' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Order cannot be cancelled in "${order.status}" status.` });
    }

    await query('UPDATE orders SET status = "cancelled" WHERE id = ?', [orderId]);

    // Notify producer
    await notify(
      order.producer_id,
      'Order Cancelled',
      `Order ${order.order_number} was cancelled by the buyer.`,
      'order_status',
      'producer-dashboard.html?tab=orders'
    );

    res.json({ success: true, message: 'Order cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order.' });
  }
});

/**
 * PATCH /api/orders/:id/complete
 * Consumer confirms delivered service completion
 */
router.patch('/:id/complete', requireAuth, async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

  try {
    const rows = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0];
    if (order.consumer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the buyer can mark an order completed.' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Order must be delivered by the producer before completion.' });
    }

    await query('UPDATE orders SET status = "completed" WHERE id = ?', [orderId]);

    // Notify producer
    await notify(
      order.producer_id,
      'Order Completed & Earnings Released',
      `Buyer confirmed completion for order ${order.order_number}!`,
      'order_status',
      'producer-dashboard.html?tab=orders'
    );

    res.json({ success: true, message: 'Order marked as completed. You can now leave a review!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete order.' });
  }
});

module.exports = router;

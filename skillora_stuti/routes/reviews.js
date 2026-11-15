const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/reviews
 * Submit a review for a completed order
 */
router.post('/', requireAuth, async (req, res) => {
  const { order_id, rating, comment } = req.body;

  const orderId = parseInt(order_id, 10);
  const numRating = parseInt(rating, 10);

  if (isNaN(orderId)) return res.status(400).json({ error: 'Valid order ID required.' });
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }

  try {
    // 1. Verify order belongs to consumer and is completed
    const orders = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found.' });

    const order = orders[0];
    if (order.consumer_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the order buyer can leave a review.' });
    }
    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Reviews can only be submitted for completed orders.' });
    }

    // 2. Check for duplicate review
    const existing = await query('SELECT id FROM reviews WHERE order_id = ?', [orderId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A review has already been submitted for this order.' });
    }

    // 3. Insert review
    const result = await query(
      `INSERT INTO reviews (order_id, service_id, consumer_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, order.service_id, req.user.id, numRating, comment ? comment.trim() : null]
    );

    // 4. Notify producer
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, 'review', 'producer-dashboard.html?tab=orders')`,
      [
        order.producer_id,
        `New ${numRating}★ Review Received!`,
        `${req.user.name} reviewed order ${order.order_number}: "${comment || 'Great service!'}"`
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      reviewId: result.insertId
    });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'Database error occurred while submitting review.' });
  }
});

/**
 * GET /api/reviews/service/:serviceId
 * Get all reviews and average rating for a service
 */
router.get('/service/:serviceId', async (req, res) => {
  const serviceId = parseInt(req.params.serviceId, 10);
  if (isNaN(serviceId)) return res.status(400).json({ error: 'Invalid service ID' });

  try {
    const sql = `
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        u.name AS consumer_name,
        u.department AS consumer_dept
      FROM reviews r
      JOIN users u ON r.consumer_id = u.id
      WHERE r.service_id = ?
      ORDER BY r.created_at DESC
    `;
    const reviews = await query(sql, [serviceId]);

    const count = reviews.length;
    const avg = count > 0 
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(1)
      : null;

    res.json({
      reviews,
      stats: {
        totalReviews: count,
        averageRating: avg ? parseFloat(avg) : null
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve service reviews' });
  }
});

module.exports = router;

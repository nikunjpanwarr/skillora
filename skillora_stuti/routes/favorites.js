const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

/**
 * GET /api/favorites
 * Get all services saved by user
 */
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT 
        s.id,
        s.title,
        s.description AS \`desc\`,
        s.price AS numeric_price,
        s.price_display,
        s.delivery_time,
        s.badge,
        c.slug AS category,
        c.name AS category_name,
        c.icon,
        c.tone,
        u.name AS creator,
        u.department AS dept,
        f.created_at AS saved_at
      FROM favorites f
      JOIN services s ON f.service_id = s.id
      JOIN categories c ON s.category_id = c.id
      JOIN users u ON s.producer_id = u.id
      WHERE f.user_id = ? AND s.status = 'active'
      ORDER BY f.created_at DESC
    `;
    const rows = await query(sql, [req.user.id]);
    const formatted = rows.map(s => ({
      ...s,
      price: s.price_display || `From ₹${Math.round(s.numeric_price)}`
    }));
    res.json({ favorites: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve favorites' });
  }
});

/**
 * GET /api/favorites/check/:serviceId
 * Check if a single service is favorited
 */
router.get('/check/:serviceId', async (req, res) => {
  const serviceId = parseInt(req.params.serviceId, 10);
  try {
    const rows = await query(
      'SELECT 1 FROM favorites WHERE user_id = ? AND service_id = ?',
      [req.user.id, serviceId]
    );
    res.json({ favorited: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check favorite state' });
  }
});

/**
 * POST /api/favorites/:serviceId
 * Save a service to favorites
 */
router.post('/:serviceId', async (req, res) => {
  const serviceId = parseInt(req.params.serviceId, 10);
  try {
    await query(
      'INSERT IGNORE INTO favorites (user_id, service_id) VALUES (?, ?)',
      [req.user.id, serviceId]
    );
    res.json({ success: true, message: 'Saved to favorites' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

/**
 * DELETE /api/favorites/:serviceId
 * Remove a service from favorites
 */
router.delete('/:serviceId', async (req, res) => {
  const serviceId = parseInt(req.params.serviceId, 10);
  try {
    await query(
      'DELETE FROM favorites WHERE user_id = ? AND service_id = ?',
      [req.user.id, serviceId]
    );
    res.json({ success: true, message: 'Removed from favorites' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');

// Strict Admin Gate
router.use(requireAuth);
router.use(requireRole(['admin']));

/**
 * GET /api/admin/stats
 * Overview platform analytics derived directly from verified database records
 */
router.get('/stats', async (req, res) => {
  try {
    const [userStats] = await query(`
      SELECT 
        COUNT(*) AS total_users,
        SUM(role = 'consumer') AS consumers,
        SUM(role = 'producer') AS producers,
        SUM(role = 'admin') AS admins
      FROM users
    `);

    const [serviceStats] = await query(`
      SELECT 
        COUNT(*) AS total_services,
        SUM(status = 'active') AS active_services,
        SUM(status = 'suspended') AS suspended_services,
        SUM(status = 'inactive') AS inactive_services
      FROM services
    `);

    const [orderStats] = await query(`
      SELECT 
        COUNT(*) AS total_orders,
        SUM(status = 'pending') AS pending_orders,
        SUM(status = 'in_progress') AS in_progress_orders,
        SUM(status = 'completed') AS completed_orders,
        SUM(status = 'cancelled') AS cancelled_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS total_gmv
      FROM orders
    `);

    const [reviewStats] = await query(`SELECT COUNT(*) AS total_reviews FROM reviews`);

    res.json({
      users: userStats,
      services: serviceStats,
      orders: {
        ...orderStats,
        total_gmv: parseFloat(orderStats?.total_gmv || 0)
      },
      reviews: reviewStats?.total_reviews || 0
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve admin stats' });
  }
});

/**
 * GET /api/admin/users
 * Search and manage users
 */
router.get('/users', async (req, res) => {
  const { q, role } = req.query;
  try {
    let whereClauses = [];
    let params = [];

    if (role) {
      whereClauses.push('role = ?');
      params.push(role);
    }
    if (q && q.trim()) {
      whereClauses.push('(name LIKE ? OR email LIKE ? OR department LIKE ?)');
      const term = `%${q.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `
      SELECT id, email, name, department, role, created_at
      FROM users
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const users = await query(sql, params);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Admin update user role
 */
router.patch('/users/:id/role', async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { role } = req.body;

  if (!['consumer', 'producer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified.' });
  }

  try {
    await query('UPDATE users SET role = ? WHERE id = ?', [role, targetId]);
    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

/**
 * GET /api/admin/services
 * Manage and moderate all service listings
 */
router.get('/services', async (req, res) => {
  const { status, category } = req.query;
  try {
    let where = [];
    let params = [];

    if (status) { where.push('s.status = ?'); params.push(status); }
    if (category) { where.push('c.slug = ?'); params.push(category); }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT 
        s.*,
        c.name AS category_name,
        u.name AS producer_name,
        u.email AS producer_email
      FROM services s
      JOIN categories c ON s.category_id = c.id
      JOIN users u ON s.producer_id = u.id
      ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT 100
    `;
    const services = await query(sql, params);
    res.json({ services });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listings for moderation' });
  }
});

/**
 * PATCH /api/admin/services/:id/status
 * Moderate listing (activate, suspend, inactive)
 */
router.patch('/services/:id/status', async (req, res) => {
  const serviceId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!['active', 'suspended', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await query('UPDATE services SET status = ? WHERE id = ?', [status, serviceId]);
    res.json({ success: true, message: `Listing status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to moderate listing' });
  }
});

/**
 * GET /api/admin/orders
 * Full audit log of all marketplace orders
 */
router.get('/orders', async (req, res) => {
  const { status } = req.query;
  try {
    let whereSql = '';
    let params = [];
    if (status) {
      whereSql = 'WHERE o.status = ?';
      params.push(status);
    }

    const sql = `
      SELECT 
        o.*,
        s.title AS service_title,
        c.name AS category_name,
        u_p.name AS producer_name,
        u_c.name AS consumer_name
      FROM orders o
      JOIN services s ON o.service_id = s.id
      JOIN categories c ON s.category_id = c.id
      JOIN users u_p ON o.producer_id = u_p.id
      JOIN users u_c ON o.consumer_id = u_c.id
      ${whereSql}
      ORDER BY o.created_at DESC
      LIMIT 100
    `;
    const orders = await query(sql, params);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders list' });
  }
});

module.exports = router;

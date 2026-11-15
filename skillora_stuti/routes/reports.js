const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

/**
 * POST /api/reports
 * Submit a report or dispute (Any authenticated university student)
 */
router.post('/', async (req, res) => {
  const { service_id, order_id, reported_user_id, reason, details } = req.body;

  if (!reason || reason.trim().length < 3) {
    return res.status(400).json({ error: 'Please select a valid report reason.' });
  }
  if (!details || details.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide at least 10 characters explaining your report.' });
  }

  try {
    const result = await query(
      `INSERT INTO reports (reporter_id, service_id, order_id, reported_user_id, reason, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        service_id ? parseInt(service_id, 10) : null,
        order_id ? parseInt(order_id, 10) : null,
        reported_user_id ? parseInt(reported_user_id, 10) : null,
        reason.trim(),
        details.trim()
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Your report has been submitted to the Bennett moderation team.',
      reportId: result.insertId
    });
  } catch (err) {
    console.error('Report submission error:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

/**
 * GET /api/reports
 * Admin view all platform reports
 */
router.get('/', requireRole(['admin']), async (req, res) => {
  const { status } = req.query;
  try {
    let whereSql = '';
    let params = [];
    if (status) {
      whereSql = 'WHERE r.status = ?';
      params.push(status);
    }

    const sql = `
      SELECT 
        r.*,
        u_rep.name AS reporter_name,
        u_rep.email AS reporter_email,
        s.title AS service_title,
        o.order_number
      FROM reports r
      JOIN users u_rep ON r.reporter_id = u_rep.id
      LEFT JOIN services s ON r.service_id = s.id
      LEFT JOIN orders o ON r.order_id = o.id
      ${whereSql}
      ORDER BY r.created_at DESC
    `;
    const reports = await query(sql, params);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve reports' });
  }
});

/**
 * PATCH /api/reports/:id
 * Admin resolve or update a report
 */
router.patch('/:id', requireRole(['admin']), async (req, res) => {
  const reportId = parseInt(req.params.id, 10);
  const { status, admin_notes } = req.body;

  if (!['pending', 'investigating', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid report status.' });
  }

  try {
    await query(
      'UPDATE reports SET status = ?, admin_notes = COALESCE(?, admin_notes) WHERE id = ?',
      [status, admin_notes || null, reportId]
    );
    res.json({ success: true, message: `Report status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

module.exports = router;

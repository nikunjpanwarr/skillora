const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * Helper: Notification creator
 */
async function notify(userId, title, message, type = 'info', link = null) {
  try {
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, link]
    );
  } catch (err) {
    console.warn('Notification error:', err.message);
  }
}

/**
 * Middleware: Ensure producer privileges (auto-upgrades willing student consumers)
 */
async function ensureProducer(req, res, next) {
  if (req.user.role === 'consumer') {
    await query('UPDATE users SET role = "producer" WHERE id = ?', [req.user.id]);
    req.user.role = 'producer';
  }
  next();
}

router.use(requireAuth);
router.use(ensureProducer);

/**
 * GET /api/producer/stats
 * Overview performance numbers derived from real DB records
 */
router.get('/stats', async (req, res) => {
  try {
    // 1. Listings count
    const [listingsCount] = await query(
      'SELECT COUNT(*) AS total, SUM(status = "active") AS active FROM services WHERE producer_id = ?',
      [req.user.id]
    );

    // 2. Orders summary
    const [orderStats] = await query(`
      SELECT 
        COUNT(*) AS total_orders,
        SUM(status = 'pending') AS pending_orders,
        SUM(status = 'in_progress' OR status = 'accepted') AS active_orders,
        SUM(status = 'completed') AS completed_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS total_earnings
      FROM orders
      WHERE producer_id = ?
    `, [req.user.id]);

    res.json({
      listings: {
        total: listingsCount?.total || 0,
        active: listingsCount?.active || 0
      },
      orders: {
        total: orderStats?.total_orders || 0,
        pending: orderStats?.pending_orders || 0,
        active: orderStats?.active_orders || 0,
        completed: orderStats?.completed_orders || 0,
        earnings: parseFloat(orderStats?.total_earnings || 0)
      }
    });
  } catch (err) {
    console.error('Error fetching producer stats:', err);
    res.status(500).json({ error: 'Failed to compute producer statistics' });
  }
});

/**
 * GET /api/producer/services
 * Get all listings created by the producer
 */
router.get('/services', async (req, res) => {
  try {
    const sql = `
      SELECT 
        s.*,
        c.name AS category_name,
        c.icon AS category_icon,
        c.tone AS category_tone
      FROM services s
      JOIN categories c ON s.category_id = c.id
      WHERE s.producer_id = ?
      ORDER BY s.created_at DESC
    `;
    const services = await query(sql, [req.user.id]);
    res.json({ services });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your services' });
  }
});

/**
 * POST /api/producer/services
 * Create a new service listing (supports multipart image attachment or json)
 */
router.post('/services', upload.single('image'), async (req, res) => {
  const { title, description, category_slug, price, delivery_time, badge } = req.body;

  if (!title || title.trim().length < 5) return res.status(400).json({ error: 'Title must be at least 5 chars.' });
  if (!description || description.trim().length < 15) return res.status(400).json({ error: 'Description must be at least 15 chars.' });
  if (!category_slug) return res.status(400).json({ error: 'Please choose a category.' });

  const numPrice = parseFloat(price) || 0;
  if (numPrice < 0) return res.status(400).json({ error: 'Price cannot be negative.' });

  try {
    let categoryId = null;
    const catQuery = category_slug.trim();
    const existingCats = await query(
      'SELECT id, name, slug FROM categories WHERE slug = ? OR LOWER(name) = LOWER(?)',
      [catQuery, catQuery]
    );

    if (existingCats.length > 0) {
      categoryId = existingCats[0].id;
    } else {
      // Auto-create category written by the student producer
      const generatedSlug = catQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || ('cat-' + Date.now());
      const slugCheck = await query('SELECT id FROM categories WHERE slug = ?', [generatedSlug]);
      if (slugCheck.length > 0) {
        categoryId = slugCheck[0].id;
      } else {
        const newCat = await query(
          'INSERT INTO categories (slug, name, icon, tone, display_order) VALUES (?, ?, "spark", "L", 99)',
          [generatedSlug, catQuery]
        );
        categoryId = newCat.insertId;
      }
    }

    const priceDisplay = numPrice > 0 ? `₹${Math.round(numPrice)}` : 'Contact for price';

    const insertSql = `
      INSERT INTO services 
        (producer_id, category_id, title, description, price, price_display, delivery_time, badge, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    const result = await query(insertSql, [
      req.user.id,
      categoryId,
      title.trim(),
      description.trim(),
      numPrice,
      priceDisplay,
      delivery_time || '2-3 days',
      badge || 'Available'
    ]);

    const serviceId = result.insertId;

    // Attach uploaded image if provided
    if (req.file) {
      const imageUrl = `/uploads/services/${req.file.filename}`;
      await query(
        'INSERT INTO service_images (service_id, image_url, is_primary) VALUES (?, ?, TRUE)',
        [serviceId, imageUrl]
      );
    } else if (req.body.image_url) {
      await query(
        'INSERT INTO service_images (service_id, image_url, is_primary) VALUES (?, ?, TRUE)',
        [serviceId, req.body.image_url.trim()]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Service published successfully!',
      serviceId,
      image_url: req.file ? `/uploads/services/${req.file.filename}` : req.body.image_url || null
    });
  } catch (err) {
    console.error('Error creating service:', err);
    res.status(500).json({ error: 'Failed to create service listing' });
  }
});

/**
 * POST /api/producer/services/:id/image
 * Upload/attach an image to an existing service listing
 */
router.post('/services/:id/image', upload.single('image'), async (req, res) => {
  const serviceId = parseInt(req.params.id, 10);
  if (!serviceId) return res.status(400).json({ error: 'Invalid service ID.' });

  try {
    const [ownership] = await query(
      'SELECT id FROM services WHERE id = ? AND producer_id = ?',
      [serviceId, req.user.id]
    );

    if (!ownership) {
      return res.status(403).json({ error: 'Unauthorized. You do not own this service listing.' });
    }

    if (!req.file && !req.body.image_url) {
      return res.status(400).json({ error: 'No image file or URL provided.' });
    }

    const imageUrl = req.file ? `/uploads/services/${req.file.filename}` : req.body.image_url.trim();
    const isPrimary = req.body.is_primary === 'true' || req.body.is_primary === true;

    if (isPrimary) {
      await query('UPDATE service_images SET is_primary = FALSE WHERE service_id = ?', [serviceId]);
    }

    await query(
      'INSERT INTO service_images (service_id, image_url, is_primary) VALUES (?, ?, ?)',
      [serviceId, imageUrl, isPrimary]
    );

    res.json({
      success: true,
      message: 'Image uploaded successfully!',
      imageUrl
    });
  } catch (err) {
    console.error('Error uploading service image:', err);
    res.status(500).json({ error: 'Failed to upload service image.' });
  }
});

/**
 * PUT /api/producer/services/:id
 * Edit an existing service listing
 */
router.put('/services/:id', async (req, res) => {
  const serviceId = parseInt(req.params.id, 10);
  const { title, description, category_slug, price, delivery_time, badge, status } = req.body;

  try {
    const check = await query('SELECT id FROM services WHERE id = ? AND producer_id = ?', [serviceId, req.user.id]);
    if (check.length === 0) return res.status(404).json({ error: 'Service not found or unauthorized.' });

    let categoryId = null;
    if (category_slug) {
      const catQuery = category_slug.trim();
      const existingCats = await query(
        'SELECT id FROM categories WHERE slug = ? OR LOWER(name) = LOWER(?)',
        [catQuery, catQuery]
      );
      if (existingCats.length > 0) {
        categoryId = existingCats[0].id;
      } else {
        const generatedSlug = catQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || ('cat-' + Date.now());
        const slugCheck = await query('SELECT id FROM categories WHERE slug = ?', [generatedSlug]);
        if (slugCheck.length > 0) {
          categoryId = slugCheck[0].id;
        } else {
          const newCat = await query(
            'INSERT INTO categories (slug, name, icon, tone, display_order) VALUES (?, ?, "spark", "L", 99)',
            [generatedSlug, catQuery]
          );
          categoryId = newCat.insertId;
        }
      }
    }

    const numPrice = parseFloat(price);
    const priceDisplay = (!isNaN(numPrice) && numPrice > 0) ? `₹${Math.round(numPrice)}` : null;

    const updates = [];
    const params = [];

    if (title) { updates.push('title = ?'); params.push(title.trim()); }
    if (description) { updates.push('description = ?'); params.push(description.trim()); }
    if (categoryId) { updates.push('category_id = ?'); params.push(categoryId); }
    if (!isNaN(numPrice)) { 
      updates.push('price = ?'); params.push(numPrice); 
      updates.push('price_display = ?'); params.push(priceDisplay);
    }
    if (delivery_time) { updates.push('delivery_time = ?'); params.push(delivery_time.trim()); }
    if (badge) { updates.push('badge = ?'); params.push(badge.trim()); }
    if (status && ['active', 'inactive', 'draft'].includes(status)) {
      updates.push('status = ?'); params.push(status);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(serviceId);
    await query(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Service updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update service' });
  }
});

/**
 * DELETE /api/producer/services/:id
 * Soft delete / deactivate service
 */
router.delete('/services/:id', async (req, res) => {
  const serviceId = parseInt(req.params.id, 10);
  try {
    const result = await query(
      'UPDATE services SET status = "inactive" WHERE id = ? AND producer_id = ?',
      [serviceId, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Service not found or unauthorized' });

    res.json({ success: true, message: 'Service deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

/**
 * GET /api/producer/orders
 * Get incoming orders for producer
 */
router.get('/orders', async (req, res) => {
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
        u.id AS consumer_id,
        u.name AS consumer_name,
        u.email AS consumer_email,
        u.department AS consumer_dept
      FROM orders o
      JOIN services s ON o.service_id = s.id
      JOIN categories c ON s.category_id = c.id
      JOIN users u ON o.consumer_id = u.id
      WHERE o.producer_id = ?
      ORDER BY o.created_at DESC
    `;
    const orders = await query(sql, [req.user.id]);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch incoming orders' });
  }
});

/**
 * PATCH /api/producer/orders/:id/status
 * Producer updates order status (accepted, rejected, in_progress, delivered)
 */
router.patch('/orders/:id/status', async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const { status } = req.body;

  const validStatuses = ['accepted', 'rejected', 'in_progress', 'delivered'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status transition requested.' });
  }

  try {
    const rows = await query('SELECT * FROM orders WHERE id = ? AND producer_id = ?', [orderId, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found or unauthorized' });

    const order = rows[0];

    // Enforce valid lifecycle transitions
    if (order.status === 'pending' && !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Pending orders can only be Accepted or Rejected.' });
    }
    if (order.status === 'accepted' && status !== 'in_progress') {
      return res.status(400).json({ error: 'Accepted orders must transition to In Progress.' });
    }
    if (order.status === 'in_progress' && status !== 'delivered') {
      return res.status(400).json({ error: 'In Progress orders must transition to Delivered.' });
    }
    if (['completed', 'cancelled', 'rejected'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot change status of an already ${order.status} order.` });
    }

    await query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    // Send notification to buyer
    const statusTitles = {
      accepted: 'Order Accepted!',
      rejected: 'Order Rejected',
      in_progress: 'Work Started on Your Order',
      delivered: 'Order Delivered! Review & Complete'
    };

    await notify(
      order.consumer_id,
      statusTitles[status] || 'Order Status Updated',
      `Producer updated order ${order.order_number} to "${status}".`,
      'order_status',
      'consumer-dashboard.html?tab=orders'
    );

    res.json({ success: true, message: `Order updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

// Sample service fallback if database is offline or empty
const FALLBACK_SERVICES = [
  {
    id: 1,
    title: "Sample service — your listing could look like this",
    desc: "This is an example, not a real service. Student services will appear here once producers publish them.",
    category: "graphic-design",
    category_name: "Graphic Design",
    icon: "pen",
    tone: "B",
    creator: "Riya K.",
    dept: "B.Des",
    price: "Your price",
    numeric_price: 299,
    badge: "Example",
    delivery_time: "2 days",
    sample: true
  }
];

/**
 * GET /api/services
 * Filter, search, and list services with pagination
 */
router.get('/', async (req, res) => {
  const { category, q, sort = 'newest', page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  try {
    let whereClauses = ["s.status = 'active'"];
    let params = [];

    if (category) {
      whereClauses.push("c.slug = ?");
      params.push(category);
    }

    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      whereClauses.push("(s.title LIKE ? OR s.description LIKE ? OR u.name LIKE ? OR c.name LIKE ?)");
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    let orderBy = 's.created_at DESC';
    if (sort === 'price_asc') {
      orderBy = 's.price ASC';
    } else if (sort === 'price_desc') {
      orderBy = 's.price DESC';
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count for pagination
    const countSql = `
      SELECT COUNT(*) AS total
      FROM services s
      JOIN categories c ON s.category_id = c.id
      JOIN users u ON s.producer_id = u.id
      ${whereSql}
    `;
    const countResult = await query(countSql, params);
    const total = countResult[0]?.total || 0;

    // Fetch paginated records
    const sql = `
      SELECT 
        s.id,
        s.title,
        s.description AS \`desc\`,
        s.price AS numeric_price,
        s.price_display,
        s.delivery_time,
        s.badge,
        s.is_sample AS sample,
        s.created_at,
        c.slug AS category,
        c.name AS category_name,
        c.icon,
        c.tone,
        u.id AS producer_id,
        u.name AS creator,
        u.department AS dept,
        u.avatar_url
      FROM services s
      JOIN categories c ON s.category_id = c.id
      JOIN users u ON s.producer_id = u.id
      ${whereSql}
      ORDER BY ${orderBy}
          LIMIT ${limitNum} OFFSET ${offset}
    `;

    const services = await query(sql, params);

    // Format display price if not stored
    const formatted = services.map(s => ({
      ...s,
      price: s.price_display || (s.numeric_price ? `From ₹${Math.round(s.numeric_price)}` : 'Available')
    }));

    return res.json({
      services: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.warn('Database error fetching services, using fallback:', err.message);
    
    // Filter fallback list in-memory
    let list = [...FALLBACK_SERVICES];
    if (category) {
      list = list.filter(s => s.category === category);
    }
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      list = list.filter(s => 
        (s.title + ' ' + s.desc + ' ' + s.creator + ' ' + s.category_name).toLowerCase().includes(term)
      );
    }
    return res.json({
      services: list,
      pagination: { page: 1, limit: limitNum, total: list.length, totalPages: 1 }
    });
  }
});

/**
 * GET /api/services/:id
 * Retrieve single service details
 */
router.get('/:id', async (req, res) => {
  const serviceId = parseInt(req.params.id, 10);
  if (isNaN(serviceId)) {
    return res.status(400).json({ error: 'Invalid service ID' });
  }

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
        s.is_sample AS sample,
        s.created_at,
        c.id AS category_id,
        c.slug AS category,
        c.name AS category_name,
        c.icon,
        c.tone,
        u.id AS producer_id,
        u.name AS creator,
        u.department AS dept,
        u.email AS creator_email,
        u.avatar_url,
        u.bio AS creator_bio
      FROM services s
      JOIN categories c ON s.category_id = c.id
      JOIN users u ON s.producer_id = u.id
      WHERE s.id = ? AND s.status = 'active'
    `;
    const rows = await query(sql, [serviceId]);

    if (rows.length === 0) {
      // Check fallback
      const foundFallback = FALLBACK_SERVICES.find(s => s.id === serviceId);
      if (foundFallback) {
        return res.json({ service: foundFallback });
      }
      return res.status(404).json({ error: 'Service not found or inactive' });
    }

    const service = rows[0];
    service.price = service.price_display || `From ₹${Math.round(service.numeric_price)}`;

    // Fetch images if any
    const images = await query(
      'SELECT image_url, is_primary FROM service_images WHERE service_id = ? ORDER BY is_primary DESC',
      [serviceId]
    );
    service.images = images.map(img => img.image_url);

    res.json({ service });
  } catch (err) {
    console.error('Error fetching service detail:', err);
    res.status(500).json({ error: 'Failed to retrieve service detail' });
  }
});

/**
 * POST /api/services
 * Create a new service listing (Requires authenticated user)
 */
router.post('/', requireAuth, async (req, res) => {
  const { title, description, category_slug, price, delivery_time, badge } = req.body;

  if (!title || title.trim().length < 5) {
    return res.status(400).json({ error: 'Service title must be at least 5 characters long.' });
  }
  if (!description || description.trim().length < 15) {
    return res.status(400).json({ error: 'Description must be at least 15 characters long.' });
  }
  if (!category_slug) {
    return res.status(400).json({ error: 'Category is required.' });
  }

  const numericPrice = parseFloat(price) || 0;
  if (numericPrice < 0) {
    return res.status(400).json({ error: 'Price cannot be negative.' });
  }

  try {
    // 1. Get category id or create custom category
    let categoryId = null;
    const catQuery = category_slug.trim();
    const existingCats = await query(
      'SELECT id, name, slug FROM categories WHERE slug = ? OR LOWER(name) = LOWER(?)',
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

    // 2. Ensure user has producer role or upgrade them
    if (req.user.role === 'consumer') {
      await query('UPDATE users SET role = "producer" WHERE id = ?', [req.user.id]);
      req.user.role = 'producer';
    }

    const priceDisplay = numericPrice > 0 ? `₹${Math.round(numericPrice)}` : 'Contact for price';

    // 3. Insert service
    const insertSql = `
      INSERT INTO services 
        (producer_id, category_id, title, description, price, price_display, delivery_time, badge, status)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    const result = await query(insertSql, [
      req.user.id,
      categoryId,
      title.trim(),
      description.trim(),
      numericPrice,
      priceDisplay,
      delivery_time || '2-3 days',
      badge || 'Available'
    ]);

    res.status(201).json({
      success: true,
      message: 'Service published successfully!',
      serviceId: result.insertId
    });
  } catch (err) {
    console.error('Failed to create service:', err);
    res.status(500).json({ error: 'Database error occurred while publishing service.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN || 'bennett.edu.in').toLowerCase();
const ENABLE_DEMO_LOGIN = process.env.ENABLE_DEMO_LOGIN === 'true';

/**
 * Helper: Derive readable name from email if not provided
 * e.g., "john.doe@bennett.edu.in" -> "John Doe"
 */
function nameFromEmail(email) {
  const local = email.split('@')[0];
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Helper: Validate university email domain strictly on the server
 */
function isUniversityEmail(email) {
  if (typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith('@' + ALLOWED_DOMAIN);
}

/**
 * Helper: Issue signed JWT and attach HTTP-only cookie
 */
function issueSession(res, user) {
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('skillora_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return token;
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user and public auth settings
 */
router.get('/me', (req, res) => {
  res.json({
    user: req.user || null,
    config: {
      allowedDomain: ALLOWED_DOMAIN,
      demoEnabled: ENABLE_DEMO_LOGIN,
      microsoftEnabled: Boolean(process.env.AZURE_CLIENT_ID),
      clientId: process.env.AZURE_CLIENT_ID || '',
      tenantId: process.env.AZURE_TENANT_ID || 'organizations'
    }
  });
});

/**
 * POST /api/auth/login/demo
 * Server-controlled demo login (active in development / demo mode only)
 */
router.post('/login/demo', async (req, res) => {
  if (!ENABLE_DEMO_LOGIN) {
    return res.status(403).json({
      error: 'Demo login disabled',
      message: 'Demo login is not permitted in production. Please use Microsoft sign-in.'
    });
  }

  const { email, name, department, role } = req.body;

  if (!email || !isUniversityEmail(email)) {
    return res.status(400).json({
      error: 'Invalid university email',
      message: `Only official @${ALLOWED_DOMAIN} university accounts are permitted.`
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (name && name.trim()) || nameFromEmail(cleanEmail);
  const cleanDept = (department && department.trim()) || 'Bennett Student';
  const cleanRole = role === 'producer' ? 'producer' : 'consumer';

  try {
    // Check if user already exists
    const existing = await query('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    let user;
    if (existing.length > 0) {
      user = existing[0];
      // Update name/dept if they were provided
      await query(
        'UPDATE users SET name = ?, department = COALESCE(?, department) WHERE id = ?',
        [cleanName, cleanDept, user.id]
      );
      user.name = cleanName;
    } else {
      // Create new student user
      const result = await query(
        `INSERT INTO users (email, name, department, role, auth_provider)
         VALUES (?, ?, ?, ?, 'demo')`,
        [cleanEmail, cleanName, cleanDept, cleanRole]
      );
      user = {
        id: result.insertId,
        email: cleanEmail,
        name: cleanName,
        department: cleanDept,
        role: cleanRole,
        avatar_url: null
      };
    }

    const token = issueSession(res, user);

    res.json({
      success: true,
      message: 'Signed in successfully via university demo mode',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        department: user.department,
        role: user.role,
        avatar_url: user.avatar_url
      },
      token
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({
      error: 'Login failed',
      message: 'Database error occurred during sign-in. Check database connection.'
    });
  }
});

/**
 * POST /api/auth/login/microsoft
 * Production Microsoft sign-in token verification
 */
router.post('/login/microsoft', async (req, res) => {
  const { accessToken, username, name } = req.body;

  if (!accessToken && !username) {
    return res.status(400).json({
      error: 'Missing Microsoft credentials',
      message: 'Access token or account identity required.'
    });
  }

  let email = username;
  let displayName = name;

  // If accessToken is provided, verify against Microsoft Graph
  if (accessToken) {
    try {
      const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (graphRes.ok) {
        const profile = await graphRes.json();
        email = profile.mail || profile.userPrincipalName;
        displayName = profile.displayName || displayName;
      }
    } catch (graphErr) {
      console.warn('Microsoft Graph verification warning:', graphErr.message);
    }
  }

  if (!email || !isUniversityEmail(email)) {
    return res.status(403).json({
      error: 'Unauthorized domain',
      message: `Your Microsoft account must belong to the @${ALLOWED_DOMAIN} university domain.`
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName || nameFromEmail(cleanEmail);

  try {
    const existing = await query('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    let user;

    if (existing.length > 0) {
      user = existing[0];
      await query('UPDATE users SET name = ?, auth_provider = "microsoft" WHERE id = ?', [cleanName, user.id]);
    } else {
      const result = await query(
        `INSERT INTO users (email, name, role, auth_provider)
         VALUES (?, ?, 'consumer', 'microsoft')`,
        [cleanEmail, cleanName]
      );
      user = {
        id: result.insertId,
        email: cleanEmail,
        name: cleanName,
        department: 'Bennett University',
        role: 'consumer'
      };
    }

    const token = issueSession(res, user);

    res.json({
      success: true,
      message: 'Signed in successfully via Microsoft Entra ID',
      user,
      token
    });
  } catch (err) {
    console.error('Microsoft login error:', err);
    res.status(500).json({ error: 'Database error occurred during Microsoft sign-in.' });
  }
});

/**
 * POST /api/auth/logout
 * Clears the session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('skillora_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * PATCH /api/auth/profile
 * Allows logged-in user to update profile / role
 */
router.patch('/profile', requireAuth, async (req, res) => {
  const { name, department, bio, phone, role } = req.body;
  const updates = [];
  const params = [];

  if (name && name.trim()) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (department !== undefined) {
    updates.push('department = ?');
    params.push(department.trim());
  }
  if (bio !== undefined) {
    updates.push('bio = ?');
    params.push(bio.trim());
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    params.push(phone.trim());
  }
  if (role && (role === 'consumer' || role === 'producer')) {
    updates.push('role = ?');
    params.push(role);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  params.push(req.user.id);
  try {
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await query('SELECT id, email, name, department, role, bio, phone FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, user: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

module.exports = router;

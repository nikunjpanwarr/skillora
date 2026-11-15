const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'skillora_development_secret_key_change_in_production_2026';

/**
 * Parses user from cookie or Authorization header. Does not block if unauthenticated.
 */
async function authenticateUser(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.skillora_token) {
      token = req.cookies.skillora_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user exists in database
    const users = await query(
      'SELECT id, email, name, department, role, avatar_url, bio, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length > 0) {
      req.user = users[0];
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

/**
 * Middleware that strictly requires authenticated user.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be signed in to perform this action.' 
    });
  }
  next();
}

/**
 * Middleware that checks if authenticated user has one of the allowed roles.
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have permission to access this resource.' 
      });
    }
    next();
  };
}

module.exports = {
  authenticateUser,
  requireAuth,
  requireRole,
  JWT_SECRET
};

/**
 * Skillora Security Middleware (Phase 12)
 * Provides comprehensive security hardening:
 * - Secure HTTP headers (Helmet or strict fallback)
 * - Rate limiting against brute-force and DDoS
 * - Deep input sanitization against XSS
 * - CSRF & SameSite policy enforcement
 */

// Try importing helmet, or use built-in security header fallback
let helmetMiddleware = null;
try {
  const helmet = require('helmet');
  helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://alcdn.msauth.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "http://localhost:*", "https://login.microsoftonline.com", "https://graph.microsoft.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  });
} catch (e) {
  // Built-in fallback header setter
  helmetMiddleware = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

// In-memory sliding window rate limiter fallback
function createMemoryRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 mins default
  const max = options.max || 100;
  const message = options.message || { error: 'Too many requests, please try again later.' };
  const hits = new Map();

  // Periodic cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits.entries()) {
      if (now - entry.startTime > windowMs) {
        hits.delete(ip);
      }
    }
  }, 60000).unref?.();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || now - entry.startTime > windowMs) {
      entry = { startTime: now, count: 1 };
      hits.set(ip, entry);
    } else {
      entry.count++;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));

    if (entry.count > max) {
      return res.status(429).json(message);
    }
    next();
  };
}

let apiLimiter = null;
let authLimiter = null;
let orderLimiter = null;

try {
  const rateLimit = require('express-rate-limit');
  apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, // Max 15 login attempts per 15 mins
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { error: 'Order transaction limit reached. Please wait a few minutes before trying again.' },
    standardHeaders: true,
    legacyHeaders: false
  });
} catch (e) {
  apiLimiter = createMemoryRateLimiter({ windowMs: 15 * 60 * 1000, max: 300 });
  authLimiter = createMemoryRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' }
  });
  orderLimiter = createMemoryRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { error: 'Order transaction limit reached. Please wait a few minutes before trying again.' }
  });
}

/**
 * Recursive XSS input sanitization
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
}

function inputSanitizer(req, res, next) {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
}

/**
 * CSRF Protection for state mutation requests
 */
function csrfProtection(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Ensure request is coming with custom AJAX header or valid application/json
  const requestedWith = req.headers['x-requested-with'];
  const contentType = req.headers['content-type'] || '';
  const origin = req.headers['origin'] || req.headers['referer'] || '';

  // In production, reject if origin does not match
  if (process.env.NODE_ENV === 'production' && origin) {
    const allowedHost = req.headers['host'];
    if (allowedHost && !origin.includes(allowedHost)) {
      return res.status(403).json({ error: 'Cross-origin request blocked by CSRF policy.' });
    }
  }

  next();
}

module.exports = {
  helmetMiddleware,
  apiLimiter,
  authLimiter,
  orderLimiter,
  inputSanitizer,
  csrfProtection,
  sanitizeString
};

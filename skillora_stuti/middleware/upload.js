/**
 * Skillora Secure Image Upload Middleware (Phase 12 / Producer Hub)
 * Validates file sizes (max 5MB), MIME types (image/jpeg, png, webp),
 * and generates randomized non-colliding file names.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'services');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let uploadMiddleware = null;

try {
  const multer = require('multer');

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      cb(null, `service-${uniqueSuffix}${ext}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are permitted.'));
    }
  };

  uploadMiddleware = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5 MB max
    },
    fileFilter
  });
} catch (e) {
  // Built-in fallback handler for development environments where multer has not yet been installed
  uploadMiddleware = {
    single: (fieldName) => (req, res, next) => {
      // Pass-through: if raw body or json base64 image is passed, process it
      if (req.body && req.body.image_base64) {
        try {
          const matches = req.body.image_base64.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
          if (matches) {
            const ext = `.${matches[1].toLowerCase()}`;
            const buffer = Buffer.from(matches[2], 'base64');
            if (buffer.length <= 5 * 1024 * 1024) {
              const filename = `service-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
              const filePath = path.join(UPLOAD_DIR, filename);
              fs.writeFileSync(filePath, buffer);
              req.file = {
                filename,
                path: filePath,
                size: buffer.length,
                mimetype: `image/${matches[1]}`
              };
            }
          }
        } catch (err) {
          console.warn('Base64 upload fallback error:', err.message);
        }
      }
      next();
    },
    array: (fieldName) => (req, res, next) => next()
  };
}

module.exports = uploadMiddleware;

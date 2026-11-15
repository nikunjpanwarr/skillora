const mysql = require('mysql2/promise');
require('dotenv').config();

const isRemoteHost = process.env.DB_HOST && !['localhost', '127.0.0.1'].includes(process.env.DB_HOST);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'skillora_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ssl: (process.env.DB_SSL === 'true' || isRemoteHost)
    ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    : undefined
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function autoInitDatabase() {
  const p = getPool();
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(191) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        department VARCHAR(50) DEFAULT NULL,
        role ENUM('consumer', 'producer', 'admin') NOT NULL DEFAULT 'consumer',
        avatar_url VARCHAR(255) DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        auth_provider VARCHAR(50) NOT NULL DEFAULT 'demo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email),
        INDEX idx_users_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) NOT NULL,
        tone VARCHAR(10) NOT NULL,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        producer_id INT NOT NULL,
        category_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        price_display VARCHAR(50) NOT NULL DEFAULT '',
        delivery_time VARCHAR(50) DEFAULT '2-3 days',
        badge VARCHAR(50) DEFAULT 'Available',
        is_sample BOOLEAN DEFAULT FALSE,
        status ENUM('active', 'inactive', 'draft', 'suspended') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_services_category (category_id),
        INDEX idx_services_producer (producer_id),
        INDEX idx_services_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL UNIQUE,
        service_id INT NOT NULL,
        consumer_id INT NOT NULL,
        producer_id INT NOT NULL,
        status ENUM('pending', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled', 'rejected') NOT NULL DEFAULT 'pending',
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        requirements TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_orders_status (status),
        INDEX idx_orders_consumer (consumer_id),
        INDEX idx_orders_producer (producer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL UNIQUE,
        service_id INT NOT NULL,
        consumer_id INT NOT NULL,
        rating INT NOT NULL,
        comment TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reviews_service (service_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_messages_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        service_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_service (user_id, service_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'general',
        link VARCHAR(255) DEFAULT '',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifs_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        service_id INT NOT NULL,
        reason VARCHAR(100) NOT NULL,
        details TEXT DEFAULT NULL,
        status ENUM('pending', 'reviewing', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed categories if empty
    const [catRows] = await p.query('SELECT COUNT(*) AS total FROM categories');
    if (catRows[0].total === 0) {
      await p.query(`
        INSERT INTO categories (id, slug, name, icon, tone, display_order) VALUES
        (1, 'video-editing', 'Video Editing', 'clap', 'L', 1),
        (2, 'graphic-design', 'Graphic Design', 'pen', 'B', 2),
        (3, 'content-writing', 'Content Writing', 'wr', 'Y', 3),
        (4, 'web-development', 'Web Development', 'code', 'L', 4),
        (5, 'photography', 'Photography', 'cam', 'B', 5),
        (6, 'social-media', 'Social Media', 'mega', 'Y', 6),
        (7, 'presentations', 'Presentations', 'pres', 'L', 7),
        (8, 'coding', 'Coding Help', 'term', 'B', 8),
        (9, 'ui-ux-design', 'UI/UX & App Design', 'pen', 'L', 9),
        (10, 'tutoring-academics', 'Tutoring & Academics', 'cap', 'Y', 10),
        (11, 'music-audio', 'Music & Audio Production', 'spark', 'B', 11),
        (12, 'career-resume', 'Resume & Career Prep', 'wr', 'L', 12),
        (13, 'event-coverage', 'Event & Campus Coverage', 'cam', 'Y', 13),
        (14, 'ai-data-analytics', 'AI & Data Analytics', 'code', 'B', 14)
      `);
      console.log('✓ Seeded 14 default campus categories into database.');
    }
    console.log('✓ Database schema verified and initialized.');
  } catch (initErr) {
    console.warn('! Auto database initialization notice:', initErr.message);
  }
}

async function testConnection() {
  try {
    const p = getPool();
    const [result] = await p.query('SELECT 1 + 1 AS result');
    await autoInitDatabase();
    return { connected: true, message: 'Database connected successfully' };
  } catch (error) {
    return { 
      connected: false, 
      message: error.message,
      code: error.code 
    };
  }
}

module.exports = {
  getPool,
  query,
  testConnection
};

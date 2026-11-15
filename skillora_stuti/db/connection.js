const mysql = require('mysql2/promise');
require('dotenv').config();

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
  keepAliveInitialDelay: 10000
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

/**
 * Execute a parameterized SQL query
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<Array>}
 */
async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

/**
 * Test the database connection and return status object
 */
async function testConnection() {
  try {
    const p = getPool();
    const [result] = await p.query('SELECT 1 + 1 AS result');
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

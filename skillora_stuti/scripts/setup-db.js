const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function setup() {
  console.log('--- Skillora Database Setup ---');
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'skillora_db';

  console.log(`Connecting to MySQL server at ${host}:${port} as ${user}...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });
    console.log('✓ Connected to MySQL server.');

    // 1. Create database
    console.log(`Creating database "${database}" if not exists...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await connection.query(`USE \`${database}\`;`);
    console.log(`✓ Using database "${database}".`);

    // 2. Run schema
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('Applying database schema from db/schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(schemaSql);
      console.log('✓ Schema applied successfully.');
    }

    // 3. Run seeds
    const seedPath = path.join(__dirname, '..', 'db', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log('Applying seed data from db/seed.sql...');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await connection.query(seedSql);
      console.log('✓ Seed data applied successfully.');
    }

    console.log('\n✓ Skillora database setup completed successfully!');
  } catch (err) {
    console.error('✗ Database setup failed:', err.message);
    console.error('Please check your .env database credentials and verify MySQL is running.');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setup();

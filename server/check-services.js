require('dotenv').config();
const { Pool } = require('pg');
const Redis = require('ioredis');

const dbUrl = process.env.DATABASE_URL || 'postgresql://masoi:masoi_dev@localhost:5432/masoi';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('\n🔍 Checking services...\n');
console.log('  DATABASE_URL:', dbUrl);
console.log('  REDIS_URL:   ', redisUrl, '\n');

async function check() {
  // PostgreSQL
  try {
    const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 3000 });
    await pool.query('SELECT 1');
    await pool.end();
    console.log('✅ PostgreSQL OK');
  } catch (err) {
    console.log('❌ PostgreSQL FAILED:', err.message);
    console.log('   Hint: docker compose -f docker-compose.dev.yml up -d');
  }

  // Redis
  try {
    const redis = new Redis(redisUrl, { connectTimeout: 3000, maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    await redis.ping();
    await redis.quit();
    console.log('✅ Redis OK');
  } catch (err) {
    console.log('❌ Redis FAILED:', err.message);
    console.log('   Hint: docker compose -f docker-compose.dev.yml up -d');
  }
}

check().then(() => { console.log('\nDone.'); process.exit(0); });

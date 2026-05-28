const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => Math.min(times * 200, 3000),
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err.message));

const ROOM_TTL = 60 * 60 * 4; // 4 hours

// ── Room state ─────────────────────────────────────────────────────────────────

async function saveRoom(code, room) {
  await redis.set(`room:${code}`, JSON.stringify(room), 'EX', ROOM_TTL);
}

async function getRoom(code) {
  const data = await redis.get(`room:${code}`);
  return data ? JSON.parse(data) : null;
}

async function deleteRoom(code) {
  await redis.del(`room:${code}`);
  await redis.srem('rooms:active', code);
}

async function listActiveRooms() {
  const codes = await redis.smembers('rooms:active');
  if (!codes.length) return [];
  const pipeline = redis.pipeline();
  codes.forEach(c => pipeline.get(`room:${c}`));
  const results = await pipeline.exec();
  const staleCodes = [];
  const rooms = results
    .map(([, data], i) => {
      if (!data) {
        staleCodes.push(codes[i]);
        return null;
      }
      return JSON.parse(data);
    })
    .filter(Boolean);
  if (staleCodes.length) await redis.srem('rooms:active', ...staleCodes);
  return rooms;
}

async function addActiveRoom(code) {
  await redis.sadd('rooms:active', code);
}

async function removeActiveRoom(code) {
  await redis.srem('rooms:active', code);
}

// ── Socket→User mapping ────────────────────────────────────────────────────────

async function setSocketUser(socketId, data) {
  await redis.set(`socket:${socketId}`, JSON.stringify(data), 'EX', ROOM_TTL);
}

async function getSocketUser(socketId) {
  const data = await redis.get(`socket:${socketId}`);
  return data ? JSON.parse(data) : null;
}

async function delSocketUser(socketId) {
  await redis.del(`socket:${socketId}`);
}

// ── User → Room mapping (ngăn 1 user vào 2 phòng) ─────────────────────────────

async function setUserRoom(userId, roomCode) {
  if (roomCode) {
    await redis.set(`user:${userId}:room`, roomCode, 'EX', ROOM_TTL);
  } else {
    await redis.del(`user:${userId}:room`);
  }
}

async function getUserRoom(userId) {
  return await redis.get(`user:${userId}:room`);
}

// ── Auth session (lightweight) ─────────────────────────────────────────────────

async function setSession(userId, data, ttl = 86400 * 7) {
  await redis.set(`session:${userId}`, JSON.stringify(data), 'EX', ttl);
}

async function getSession(userId) {
  const data = await redis.get(`session:${userId}`);
  return data ? JSON.parse(data) : null;
}

async function testConnection() {
  await redis.ping();
  console.log('✅ Redis connected');
}

module.exports = {
  redis,
  saveRoom, getRoom, deleteRoom, listActiveRooms, addActiveRoom, removeActiveRoom,
  setSocketUser, getSocketUser, delSocketUser,
  setUserRoom, getUserRoom,
  setSession, getSession,
  testConnection,
};

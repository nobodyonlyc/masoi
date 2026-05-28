require('dotenv').config();

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]:', err.message);
  if (err.code === 'EADDRINUSE') process.exit(1);
});

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const { ROLES, assignRoles, checkWinCondition, generateRoomCode } = require('./gameEngine');
const db    = require('./db/postgres');
const cache = require('./db/redis');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'], credentials: false },
  pingTimeout: 60000,
  pingInterval: 10000,
  upgradeTimeout: 10000,
});

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type'], credentials: false }));
app.options('*', cors());
app.use(express.json());

// ── Startup ────────────────────────────────────────────────────────────────────
async function waitForServices(retries = 15, delay = 2000) {
  console.log('Connecting to services...');
  console.log('  PostgreSQL:', process.env.DATABASE_URL || '(fallback)');
  console.log('  Redis:     ', process.env.REDIS_URL    || 'redis://localhost:6379');
  for (let i = 0; i < retries; i++) {
    try {
      await db.testConnection();
      await cache.testConnection();
      return true;
    } catch (err) {
      console.log(`Attempt ${i+1}/${retries} failed: ${err.message}`);
      if (i === retries - 1) throw new Error(
        `Could not connect after ${retries} attempts.\n  Run: docker compose -f docker-compose.dev.yml up -d`
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── REST ───────────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error:'Thiếu thông tin' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error:'Tên 2-20 ký tự' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await db.createUser(username.trim(), hash);
    if (!user) return res.status(409).json({ error:'Tên đã tồn tại' });
    const stats = await db.getUserStats(user.id);
    res.json({ ok:true, userId:user.id, username:user.username, stats });
  } catch (err) { console.error('register:', err); res.status(500).json({ error:'Lỗi server' }); }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.findUser(username);
    if (!user) return res.status(401).json({ error:'Sai tên hoặc mật khẩu' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error:'Sai tên hoặc mật khẩu' });
    res.json({ ok:true, userId:user.id, username:user.username,
      stats:{ games: user.games_played||0, wins: user.games_won||0 } });
  } catch (err) { console.error('login:', err); res.status(500).json({ error:'Lỗi server' }); }
});

app.get('/api/rooms', async (_req, res) => {
  try {
    const rooms = await cache.listActiveRooms();
    res.json(rooms.filter(r => !r.private && r.phase !== 'ended').map(r => ({
      code:r.code, name:r.name, hostName:r.hostName,
      playerCount:r.players.length, maxPlayers:r.config.maxPlayers,
      status: r.phase === 'waiting' ? 'waiting' : 'playing', round:r.round,
    })));
  } catch { res.json([]); }
});

// Spectator: thông tin phòng đang chơi (không lộ role của người còn sống)
app.get('/api/room/:code', async (req, res) => {
  try {
    const room = await cache.getRoom(req.params.code?.toUpperCase());
    if (!room || room.phase === 'ended') return res.status(404).json({ error:'Không tìm thấy phòng' });
    res.json({
      code: room.code, name: room.name, phase: room.phase, round: room.round,
      hostName: room.hostName,
      config: { maxPlayers: room.config.maxPlayers },
      events: room.events || [],
      players: room.players.map(p => ({
        userId: p.userId, username: p.username, alive: p.alive,
        // Chỉ lộ role nếu đã chết hoặc idiotRevealed
        role: (!p.alive || p.idiotRevealed) ? p.role : null,
      })),
    });
  } catch { res.status(500).json({ error:'Lỗi server' }); }
});

app.get('/api/leaderboard', async (_req, res) => {
  try { res.json(await db.getLeaderboard(20)); } catch { res.json([]); }
});

// #10: lịch sử ván của user
app.get('/api/my-games/:userId', async (req, res) => {
  try {
    const games = await db.getUserGames(req.params.userId, 20);
    res.json(games);
  } catch (err) { console.error('my-games:', err.message); res.json([]); }
});

app.get('/health', (_req, res) => res.json({ ok:true }));

// ── Helpers ────────────────────────────────────────────────────────────────────
const isWolf = role => ['WOLF','WOLF_KING'].includes(role);

function sanitizePlayers(players, viewerId, revealDead = false) {
  return players.map(p => ({
    userId: p.userId, username: p.username, alive: p.alive,
    ready: p.ready, muted: p.muted || false,
    idiotRevealed: p.idiotRevealed || false,
    role: revealDead && !p.alive
      ? p.role
      : (p.userId === viewerId ? p.role : (p.idiotRevealed ? p.role : null)),
  }));
}

function sanitizeRoom(room, viewerId) {
  return {
    code:room.code, name:room.name, hostId:room.hostId, hostName:room.hostName,
    config:room.config, phase:room.phase, round:room.round, events:room.events,
    players: sanitizePlayers(room.players, viewerId, room.phase === 'ended'),
  };
}

function addEvent(room, text) {
  room.events.push({ text, ts:Date.now() });
  if (room.events.length > 100) room.events.shift();
}

async function persistRoom(room) {
  await cache.saveRoom(room.code, room);
}

// Helper: emit phase_changed + lưu phaseStartedAt để reconnect tính lại timer
async function emitPhaseChanged(code, room, phase, round, duration) {
  room.phaseStartedAt = Date.now();
  room.phaseDuration  = duration;
  await persistRoom(room); // lưu để reconnect đọc được
  io.to(code).emit('phase_changed', { phase, round, duration });
}

function markNightResolving(room) {
  if (room._resolvingNight) return false;
  room._resolvingNight = true;
  return true;
}

function getWolfAttackTargetId(room) {
  const attack = room.nightActions?.WOLF_ATTACK;
  return typeof attack === 'object' && attack ? attack.targetId : attack;
}

function getWolfAttackPayload(room) {
  const attack = room.nightActions?.WOLF_ATTACK;
  if (!attack || typeof attack !== 'object') return null;
  const target = room.players.find(p => p.userId === attack.targetId);
  return {
    ...attack,
    targetName: target?.username || null,
  };
}

function emitToWolves(room, event, payload) {
  room.players.filter(p => isWolf(p.role)).forEach(p => {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit(event, payload);
  });
}

function buildRoleAssignedPayload(room, player) {
  const wolves = room.players.filter(p => isWolf(p.role)).map(p => ({
    userId:p.userId,
    username:p.username,
    role:p.role,
    roleName:ROLES[p.role]?.name,
  }));
  return {
    role: player.role,
    roleInfo: ROLES[player.role],
    wolves: isWolf(player.role) ? wolves : [],
  };
}

function getRemainingPhaseDuration(room) {
  if (!room.phaseStartedAt || !room.phaseDuration) return 0;
  const elapsed = Math.floor((Date.now() - room.phaseStartedAt) / 1000);
  return Math.max(0, room.phaseDuration - elapsed);
}

function emitPendingSpecialState(socket, room, userId) {
  if (room.pendingHunterShoot === userId) {
    socket.emit('hunter_must_shoot', {
      players: room.players.filter(p => p.alive).map(p => ({ userId:p.userId, username:p.username })),
    });
  }
  if (room.pendingWolfKingKill === userId) {
    socket.emit('wolf_king_must_choose', {
      players: room.players.filter(p => p.alive).map(p => ({ userId:p.userId, username:p.username })),
    });
  }
}

function emitResumeState(socket, room, userId) {
  const player = room.players.find(p => p.userId === userId);
  if (!player || room.phase === 'waiting') return;

  if (room.phase === 'ended') {
    const win = checkWinCondition(room.players);
    const revealed = room.players.map(p => ({ ...p, roleInfo:ROLES[p.role] }));
    socket.emit('game_ended', {
      winner: win?.winner || null,
      reason: win?.reason || 'Ván đã kết thúc.',
      players: revealed,
      events: room.events || [],
    });
    return;
  }

  if (player.role) socket.emit('role_assigned', buildRoleAssignedPayload(room, player));
  socket.emit('phase_changed', {
    phase:room.phase,
    round:room.round,
    duration:getRemainingPhaseDuration(room),
  });
  if (isWolf(player.role)) {
    socket.emit('wolf_target_updated', getWolfAttackPayload(room));
    (room.wolfChat || []).forEach(msg => socket.emit('wolf_message', msg));
  }
  if (room.lastNightDeaths?.length) {
    socket.emit('night_resolved', {
      deaths: room.lastNightDeaths,
      events: room.events,
      players: sanitizePlayers(room.players, userId, true),
    });
  }
  emitPendingSpecialState(socket, room, userId);
}

// Wrap async socket handlers để unhandled rejection không crash server
function safeHandler(name, fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[socket:${name}] error:`, err.message);
    }
  };
}

const roomLocks = new Map();

async function withRoomLock(code, fn) {
  const key = code?.toUpperCase?.() || code;
  if (!key) return fn();
  const previous = roomLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  roomLocks.set(key, previous.then(() => current, () => current));
  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (roomLocks.get(key) === current) roomLocks.delete(key);
  }
}

// ── Socket.IO ──────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('auth', safeHandler('auth', async ({ userId, username }) => {
    const roomCode = await cache.getUserRoom(userId);
    const room = roomCode ? await cache.getRoom(roomCode) : null;
    await cache.setSocketUser(socket.id, { userId, username, roomCode:room ? roomCode : null });

    if (!room) {
      if (roomCode) await cache.setUserRoom(userId, null);
      return;
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      await cache.setUserRoom(userId, null);
      return;
    }

    player.socketId = socket.id;
    await persistRoom(room);
    socket.join(roomCode);
    socket.emit('room_joined', { code:roomCode, room:sanitizeRoom(room, userId) });

    if (room.phase !== 'waiting') {
      emitResumeState(socket, room, userId);
      io.to(roomCode).emit('player_online', { userId, username:player.username });
    }
  }));

  socket.on('create_room', safeHandler('create_room', async ({ userId, username, config, roomName, isPrivate }) => {
    // Kiểm tra user đang ở phòng khác không
    const existingRoom = await cache.getUserRoom(userId);
    if (existingRoom) {
      const r = await cache.getRoom(existingRoom);
      if (r) return socket.emit('error', { msg:'Bạn đang ở trong một phòng khác. Hãy rời phòng trước.' });
      // Phòng đó đã bị xóa → clear mapping cũ
      await cache.setUserRoom(userId, null);
    }

    const code = generateRoomCode();
    const room = {
      code, name: roomName || `Phòng của ${username}`,
      hostId:userId, hostName:username, private:!!isPrivate,
      config: {
        maxPlayers:  config?.maxPlayers  || 10,
        discussTime: config?.discussTime || 90,
        nightTime:   config?.nightTime   || 30,
        voteTime:    config?.voteTime    || 60,
        roles:       config?.roles       || null,
      },
      players: [{ userId, username, socketId:socket.id, alive:true, ready:false, role:null, muted:false }],
      phase:'waiting', round:0, nightActions:{}, votes:{},
      witchUsed:{ save:false, poison:false },
      doctorLastSaved: null,
      events:[], chat:[], wolfChat:[],
      startedAt:null, _resolvingNight:false,
    };
    await cache.saveRoom(code, room);
    await cache.addActiveRoom(code);
    await cache.setSocketUser(socket.id, { userId, username, roomCode:code });
    await cache.setUserRoom(userId, code);
    socket.join(code);
    socket.emit('room_created', { code, room:sanitizeRoom(room, userId) });
  }));

  socket.on('join_room', safeHandler('join_room', async ({ code, userId, username }) => {
    const upperCode = code?.toUpperCase();
    await withRoomLock(upperCode, async () => {
    const room = await cache.getRoom(upperCode);
    if (!room) return socket.emit('error', { msg:'Không tìm thấy phòng' });

    const existing = room.players.find(p => p.userId === userId);
    if (existing) {
      // Reconnect vào phòng cũ → cho phép, cập nhật socketId
      existing.socketId = socket.id;
      await persistRoom(room);
      await cache.setSocketUser(socket.id, { userId, username, roomCode:upperCode });
      await cache.setUserRoom(userId, upperCode);
      socket.join(upperCode);
      socket.emit('room_joined', { code:upperCode, room:sanitizeRoom(room, userId) });
      // #3: thông báo reconnect cho cả phòng
      if (room.phase !== 'waiting') {
        io.to(upperCode).emit('player_online', { userId, username });
      }
      if (room.phase !== 'waiting') emitResumeState(socket, room, userId);
      return;
    }

    // User chưa ở phòng này — kiểm tra có đang ở phòng KHÁC không
    const currentRoom = await cache.getUserRoom(userId);
    if (currentRoom && currentRoom !== upperCode) {
      const cr = await cache.getRoom(currentRoom);
      if (cr) return socket.emit('error', { msg:`Bạn đang ở phòng ${currentRoom}. Hãy rời phòng trước.` });
      // Phòng cũ đã hết → clear
      await cache.setUserRoom(userId, null);
    }

    if (room.phase !== 'waiting') return socket.emit('error', { msg:'Ván đang diễn ra' });
    if (room.players.length >= room.config.maxPlayers) return socket.emit('error', { msg:'Phòng đã đầy' });

    room.players.push({ userId, username, socketId:socket.id, alive:true, ready:false, role:null, muted:false });
    await persistRoom(room);
    await cache.setSocketUser(socket.id, { userId, username, roomCode:upperCode });
    await cache.setUserRoom(userId, upperCode);
    socket.join(upperCode);
    socket.emit('room_joined', { code:upperCode, room:sanitizeRoom(room, userId) });
    io.to(upperCode).emit('room_updated', sanitizeRoom(room, null));
    io.to(upperCode).emit('chat_message', { system:true, text:`${username} đã vào phòng`, ts:Date.now() });
    });
  }));

  socket.on('toggle_ready', safeHandler('toggle_ready', async ({ code, userId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room || room.phase !== 'waiting') return;
    const p = room.players.find(p => p.userId === userId);
    if (!p) return;
    p.ready = !p.ready;
    await persistRoom(room);
    io.to(code).emit('room_updated', sanitizeRoom(room, null));
    });
  }));

  // Host cập nhật config phòng khi đang chờ
  socket.on('update_config', safeHandler('update_config', async ({ code, userId, config }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room || room.phase !== 'waiting') return;
    if (room.hostId !== userId) return socket.emit('error', { msg:'Chỉ host mới được đổi cấu hình' });
    if (config.maxPlayers)  room.config.maxPlayers  = Math.min(15, Math.max(4, +config.maxPlayers));
    if (config.discussTime) room.config.discussTime = Math.min(300, Math.max(30, +config.discussTime));
    if (config.nightTime)   room.config.nightTime   = Math.min(90, Math.max(15, +config.nightTime));
    if (config.voteTime)    room.config.voteTime    = Math.min(180, Math.max(15, +config.voteTime));
    await persistRoom(room);
    io.to(code).emit('room_updated', sanitizeRoom(room, null));
    });
  }));

  socket.on('start_game', safeHandler('start_game', async ({ code, userId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room) return;
    if (room.hostId !== userId) return socket.emit('error', { msg:'Chỉ host mới được bắt đầu' });
    if (room.players.length < 4) return socket.emit('error', { msg:'Cần ít nhất 4 người' });
    if (room.phase !== 'waiting') return socket.emit('error', { msg:'Ván đang diễn ra' });

    // Kiểm tra tất cả người chơi (trừ host) đã sẵn sàng
    const notReady = room.players.filter(p => p.userId !== room.hostId && !p.ready);
    if (notReady.length > 0) {
      const names = notReady.map(p => p.username).join(', ');
      return socket.emit('error', { msg:`Chưa đủ sẵn sàng: ${names} chưa sẵn sàng` });
    }

    const roleMap = assignRoles(room.players.map(p => ({ id:p.userId })), room.config.roles);
    room.players.forEach(p => { p.role = roleMap[p.userId]; p.alive = true; p.idiotRevealed = false; });
    room.witchUsed    = { save:false, poison:false };
    room.doctorLastSaved = null;
    room.phase        = 'night';
    room.round        = 1;
    room.nightActions = {};
    room.votes        = {};
    room.events       = [];
    room.chat         = [];
    room.wolfChat     = [];
    room.lastNightDeaths = [];
    room._resolvingNight = false;
    room._resolvingVote = false;
    room.startedAt    = new Date().toISOString();
    await persistRoom(room);

    room.players.forEach(p => {
      if (!p.socketId) return;
      const s = io.sockets.sockets.get(p.socketId);
      if (!s) return;
      s.emit('role_assigned', buildRoleAssignedPayload(room, p));
    });

    io.to(code).emit('game_started', { players:sanitizePlayers(room.players, null, false), round:room.round });
    await emitPhaseChanged(code, room, 'night', room.round, room.config.nightTime);
    scheduleNight(room, code);
    addEvent(room, '🌙 Ván mới bắt đầu! Màn đêm đầu tiên buông xuống...');
    await persistRoom(room);
    });
  }));

  socket.on('night_action', safeHandler('night_action', async ({ code, userId, action, targetId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room || room.phase !== 'night') return;
    const actor = room.players.find(p => p.userId === userId);
    if (!actor || !actor.alive) return;

    if ((actor.role === 'WOLF' || actor.role === 'WOLF_KING') && targetId) {
      const target = room.players.find(p => p.userId === targetId);
      if (!target) return socket.emit('error', { msg:'Mục tiêu không tồn tại' });
      if (isWolf(target.role)) return socket.emit('error', { msg:'Không thể tấn công đồng bọn!' });
      if (!target.alive) return socket.emit('error', { msg:'Người này đã chết rồi' });
      room.nightActions.WOLF_ATTACK = {
        targetId,
        selectedBy: userId,
        selectedByName: actor.username,
        selectedAt: Date.now(),
      };
      emitToWolves(room, 'wolf_target_updated', getWolfAttackPayload(room));
    }

    if (actor.role === 'SEER' && targetId) {
      const target = room.players.find(p => p.userId === targetId);
      if (!target || !target.alive) return socket.emit('error', { msg:'Chỉ có thể xem người còn sống' });
      room.nightActions.SEER = targetId;
      socket.emit('seer_result', { targetId, targetName:target.username, isWolf: isWolf(target.role) });
    }

    if (actor.role === 'DOCTOR' && targetId) {
      const target = room.players.find(p => p.userId === targetId);
      if (!target || !target.alive) return socket.emit('error', { msg:'Người này không hợp lệ' });
      if (room.doctorLastSaved === targetId) return socket.emit('error', { msg:'Không thể cứu cùng 1 người 2 đêm liên tiếp!' });
      room.nightActions.DOCTOR = targetId;
    }

    if (actor.role === 'WITCH') {
      if (room.nightActions.WITCH_SAVE || room.nightActions.WITCH_POISON || room.nightActions.WITCH_SKIP) {
        return socket.emit('error', { msg:'Phù Thủy chỉ được dùng tối đa 1 hành động mỗi đêm' });
      }
      if (action === 'save' && targetId) {
        if (room.witchUsed.save) return socket.emit('error', { msg:'Đã dùng thuốc cứu rồi' });
        if (targetId === userId) return socket.emit('error', { msg:'Phù Thủy không thể cứu chính mình!' });
        const wolfTarget = getWolfAttackTargetId(room);
        if (!wolfTarget || targetId !== wolfTarget) return socket.emit('error', { msg:'Thuốc cứu chỉ dùng cho người đang bị Sói cắn' });
        room.nightActions.WITCH_SAVE = targetId;
      }
      if (action === 'poison' && targetId) {
        if (room.witchUsed.poison) return socket.emit('error', { msg:'Đã dùng thuốc độc rồi' });
        if (targetId === userId) return socket.emit('error', { msg:'Phù Thủy không thể tự độc!' });
        const target = room.players.find(p => p.userId === targetId);
        if (!target || !target.alive) return socket.emit('error', { msg:'Mục tiêu không hợp lệ' });
        room.nightActions.WITCH_POISON = targetId;
      }
      if (action === 'skip') room.nightActions.WITCH_SKIP = true;
    }

    await persistRoom(room);
    await checkNightComplete(room, code);
    });
  }));

  socket.on('witch_peek', safeHandler('witch_peek', async ({ code, userId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room || room.phase !== 'night') return;
    const actor = room.players.find(p => p.userId === userId);
    if (!actor || !actor.alive || actor.role !== 'WITCH') return;
    const attackedId = getWolfAttackTargetId(room);
    const attacked = attackedId ? room.players.find(p => p.userId === attackedId) : null;
    socket.emit('witch_peek_result', {
      attackedId: attackedId || null,
      attackedName: attacked?.username || null,
      canSave: !room.witchUsed.save,
      canPoison: !room.witchUsed.poison,
    });
    });
  }));

  socket.on('night_skip', safeHandler('night_skip', async ({ code, userId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room || room.phase !== 'night') return;
    const actor = room.players.find(p => p.userId === userId);
    if (!actor || !actor.alive) return;
    if (actor.role === 'WITCH')                        room.nightActions.WITCH_SKIP  = true;
    else if (actor.role === 'SEER')                    room.nightActions.SEER_SKIP   = true;
    else if (actor.role === 'DOCTOR')                  room.nightActions.DOCTOR_SKIP = true;
    else if (actor.role === 'WOLF' || actor.role === 'WOLF_KING') {
      // Wolf bỏ qua đêm nay — không cắn ai
      // Đánh dấu bằng sentinel value để checkNightComplete biết wolf đã quyết định
      delete room.nightActions.WOLF_ATTACK;
      room.nightActions.WOLF_SKIP = userId;
      emitToWolves(room, 'wolf_target_updated', null);
    }
    await persistRoom(room);
    await checkNightComplete(room, code);
    });
  }));

  socket.on('cast_vote', safeHandler('cast_vote', async ({ code, userId, targetId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room || room.phase !== 'vote') return;
    const voter = room.players.find(p => p.userId === userId);
    if (!voter || !voter.alive) return;
    if (voter.role === 'IDIOT' && voter.idiotRevealed) return;
    const target = room.players.find(p => p.userId === targetId);
    if (!target || !target.alive) return socket.emit('error', { msg:'Không thể vote người đã chết' });
    if (targetId === userId) return socket.emit('error', { msg:'Không thể vote chính mình' });
    if (room.votes[userId]) return;
    room.votes[userId] = targetId;

    // Tính số người có quyền vote
    const aliveCanVote = room.players.filter(p => p.alive && !(p.role === 'IDIOT' && p.idiotRevealed));
    const voteCount = Object.keys(room.votes).length;
    const allVoted  = voteCount >= aliveCanVote.length;

    // Persist trước
    await persistRoom(room);
    io.to(code).emit('votes_updated', { votes:room.votes });

    // Resolve ngay nếu đủ phiếu và chưa đang resolve
    if (allVoted && !room._resolvingVote) {
      room._resolvingVote = true;
      await persistRoom(room);
      await resolveVote(room, code);
    }
    });
  }));

  socket.on('hunter_shoot', safeHandler('hunter_shoot', async ({ code, userId, targetId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room) return;
    const hunter = room.players.find(p => p.userId === userId);
    if (!hunter || hunter.role !== 'HUNTER' || hunter.alive) return;
    if (!room.pendingHunterShoot || room.pendingHunterShoot !== userId) return;
    const target = room.players.find(p => p.userId === targetId);
    if (!target || !target.alive) return socket.emit('error', { msg:'Mục tiêu không hợp lệ' });
    target.alive = false;
    room.pendingHunterShoot = null;
    addEvent(room, `🏹 ${hunter.username} (Thợ Săn) bắn chết ${target.username}!`);
    const win = checkWinCondition(room.players);
    await persistRoom(room);
    io.to(code).emit('hunter_shot', {
      hunterId: hunter.userId, hunterName: hunter.username,
      targetId: target.userId, targetName: target.username, targetRole: target.role,
      events: room.events, players: sanitizePlayers(room.players, null, true),
    });
    if (win) return endGame(room, code, win);
    if (room._afterHunterPhase === 'night_end') {
      room.phase = 'discuss'; room._afterHunterPhase = null;
      await persistRoom(room);
      await emitPhaseChanged(code, room, 'discuss', room.round, room.config.discussTime);
      scheduleVote(room, code);
    } else if (room._afterHunterPhase === 'vote_end') {
      room.phase = 'night'; room._afterHunterPhase = null; room._resolvingNight = false;
      await persistRoom(room);
      await emitPhaseChanged(code, room, 'night', room.round, room.config.nightTime);
      scheduleNight(room, code);
    }
    });
  }));

  socket.on('wolf_king_target', safeHandler('wolf_king_target', async ({ code, userId, targetId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room) return;
    const wk = room.players.find(p => p.userId === userId);
    if (!wk || wk.role !== 'WOLF_KING' || wk.alive) return;
    if (!room.pendingWolfKingKill || room.pendingWolfKingKill !== userId) return;
    const target = room.players.find(p => p.userId === targetId);
    if (!target || !target.alive) return socket.emit('error', { msg:'Mục tiêu không hợp lệ' });
    target.alive = false;
    room.pendingWolfKingKill = null;
    addEvent(room, `👑 ${wk.username} (Sói Chúa) kéo ${target.username} chết cùng!`);
    const win = checkWinCondition(room.players);
    await persistRoom(room);
    io.to(code).emit('wolf_king_dragged', {
      wkId: wk.userId, wkName: wk.username,
      targetId: target.userId, targetName: target.username, targetRole: target.role,
      events: room.events, players: sanitizePlayers(room.players, null, true),
    });
    if (win) return endGame(room, code, win);
    room.phase = 'night'; room._afterHunterPhase = null; room._resolvingNight = false;
    await persistRoom(room);
    await emitPhaseChanged(code, room, 'night', room.round, room.config.nightTime);
    scheduleNight(room, code);
    });
  }));

  socket.on('send_message', safeHandler('send_message', async ({ code, userId, username, text, channel }) => {
    await withRoomLock(code, async () => {
    if (!text?.trim()) return;
    const room = await cache.getRoom(code);
    if (!room) return;
    const player = room.players.find(p => p.userId === userId);
    if (!player) return;
    if (channel === 'wolf') {
      if (!isWolf(player.role)) return;
      if (!player.alive) return;
      const msg = { userId, username, text:text.trim(), ts:Date.now(), channel:'wolf' };
      room.wolfChat = room.wolfChat || [];
      room.wolfChat.push(msg);
      if (room.wolfChat.length > 200) room.wolfChat.shift();
      await persistRoom(room);
      // #5: sói chết vẫn nhận được wolf chat
      room.players.filter(p => isWolf(p.role)).forEach(p => {
        const s = io.sockets.sockets.get(p.socketId);
        if (s) s.emit('wolf_message', msg);
      });
    } else {
      // #4: người chết không gửi được nhưng vẫn NHẬN được (broadcast to all)
      // Chỉ block GỬNG từ người chết khi đang chơi
      if (room.phase !== 'waiting' && !player.alive) return;
      if (room.phase === 'night' && player.alive) return;
      const msg = { userId, username, text:text.trim(), ts:Date.now(), channel:'public' };
      room.chat.push(msg);
      if (room.chat.length > 200) room.chat.shift();
      await persistRoom(room);
      io.to(code).emit('chat_message', msg); // broadcast đến tất cả kể cả người chết
    }
    });
  }));

  socket.on('leave_room', safeHandler('leave_room', async ({ code, userId }) => {
    await withRoomLock(code, () => handleLeave(socket, code, userId, false));
  }));

  socket.on('close_room', safeHandler('close_room', async ({ code, userId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room) return;
    if (room.hostId !== userId) return socket.emit('error', { msg:'Chỉ host mới được đóng phòng' });
    await closeRoom(code, room, 'Host đã đóng phòng');
    });
  }));

  // Host bấm "Chơi lại" → reset phòng về waiting
  socket.on('play_again', safeHandler('play_again', async ({ code, userId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room || room.phase !== 'ended') return;
    if (room.hostId !== userId) return socket.emit('error', { msg:'Chỉ host mới được reset' });
    room.phase = 'waiting';
    room.players.forEach(p => { p.alive=true; p.role=null; p.ready=false; p.idiotRevealed=false; });
    room.round=0; room.events=[]; room.chat=[];
    room.wolfChat=[]; room.lastNightDeaths=[];
    room.witchUsed={ save:false, poison:false }; room.doctorLastSaved=null;
    room.nightActions={}; room.votes={};
    room.pendingHunterShoot=null; room.pendingWolfKingKill=null;
    room._resolvingNight=false; room._afterHunterPhase=null;
    room._resolvingVote=false; room.phaseStartedAt=null; room.phaseDuration=null;
    await persistRoom(room);
    io.to(code).emit('room_reset', sanitizeRoom(room, null));
    });
  }));

  socket.on('kick_player', safeHandler('kick_player', async ({ code, userId, targetId }) => {
    await withRoomLock(code, async () => {
    const room = await cache.getRoom(code);
    if (!room || room.hostId !== userId || room.phase !== 'waiting') return;
    const target = room.players.find(p => p.userId === targetId);
    if (!target) return;
    const ts = io.sockets.sockets.get(target.socketId);
    if (ts) { ts.emit('kicked', { reason:'Bị host kick' }); ts.leave(code); }
    room.players = room.players.filter(p => p.userId !== targetId);
    await cache.setUserRoom(targetId, null);
    await persistRoom(room);
    io.to(code).emit('room_updated', sanitizeRoom(room, null));
    });
  }));

  socket.on('disconnect', safeHandler('disconnect', async () => {
    const u = await cache.getSocketUser(socket.id);
    if (u?.roomCode && u?.userId) await withRoomLock(u.roomCode, () => handleLeave(socket, u.roomCode, u.userId, true));
    await cache.delSocketUser(socket.id);
  }));

});

// ── Game flow ──────────────────────────────────────────────────────────────────
async function checkNightComplete(room, code) {
  const aliveWolf   = room.players.find(p => p.alive && isWolf(p.role));
  const aliveSeer   = room.players.find(p => p.alive && p.role === 'SEER');
  const aliveDoctor = room.players.find(p => p.alive && p.role === 'DOCTOR');
  const aliveWitch  = room.players.find(p => p.alive && p.role === 'WITCH');
  // BUG A FIX + WOLF_SKIP: wolf done nếu không có sói alive, đã attack, hoặc chủ động bỏ qua
  const wolfDone   = !aliveWolf || !!room.nightActions.WOLF_ATTACK || !!room.nightActions.WOLF_SKIP;
  const seerDone   = !aliveSeer   || !!room.nightActions.SEER   || !!room.nightActions.SEER_SKIP;
  const doctorDone = !aliveDoctor || !!room.nightActions.DOCTOR || !!room.nightActions.DOCTOR_SKIP;
  const witchDone  = !aliveWitch  || !!room.nightActions.WITCH_SAVE || !!room.nightActions.WITCH_POISON || !!room.nightActions.WITCH_SKIP;
  if (wolfDone && seerDone && doctorDone && witchDone) {
    // BUG E FIX: persist _resolvingNight=true lên Redis TRƯỚC khi resolveNight
    if (!markNightResolving(room)) return;
    await persistRoom(room);
    await resolveNight(room, code);
  }
}

async function resolveNight(room, code) {
  const actions = room.nightActions;
  const deaths  = [];
  let wolfTarget = getWolfAttackTargetId(room);
  let savedBy = null; // track ai cứu để log đúng — BUG C FIX

  if (actions.DOCTOR && actions.DOCTOR === wolfTarget) {
    savedBy = 'doctor';
    wolfTarget = null;
    room.doctorLastSaved = actions.DOCTOR;
  } else if (actions.DOCTOR) {
    room.doctorLastSaved = actions.DOCTOR;
  } else {
    room.doctorLastSaved = null;
  }

  if (actions.WITCH_SAVE && !room.witchUsed.save) {
    if (actions.WITCH_SAVE === wolfTarget) {
      // Witch cứu người bị sói tấn công (Doctor chưa cứu)
      savedBy = 'witch';
      wolfTarget = null;
      room.witchUsed.save = true;
    } else if (savedBy === 'doctor' && actions.WITCH_SAVE === actions.DOCTOR) {
      // Cả Doctor lẫn Witch cùng cứu 1 người — tiêu tốn thuốc Witch
      savedBy = 'both';
      room.witchUsed.save = true;
    }
  }

  // BUG C FIX: log message đúng theo ai đã cứu
  if (savedBy === 'doctor')  addEvent(room, '💉 Thầy thuốc đã cứu được một người đêm qua!');
  else if (savedBy === 'witch')  addEvent(room, '🧪 Phù thủy đã dùng thuốc cứu!');
  else if (savedBy === 'both')   addEvent(room, '💉🧪 Thầy thuốc và Phù thủy cùng cứu một người — thuốc Phù Thủy bị tiêu tốn!');

  if (wolfTarget) {
    const victim = room.players.find(p => p.userId === wolfTarget);
    if (victim && victim.alive) {
      victim.alive = false;
      deaths.push({ userId:victim.userId, username:victim.username, role:victim.role, cause:'wolf' });
      addEvent(room, `🐺 ${victim.username} đã bị ma sói ăn thịt đêm qua!`);
    }
  }

  if (actions.WITCH_POISON && !room.witchUsed.poison) {
    const target = room.players.find(p => p.userId === actions.WITCH_POISON);
    if (target && target.alive) {
      target.alive = false;
      room.witchUsed.poison = true;
      deaths.push({ userId:target.userId, username:target.username, role:target.role, cause:'poison' });
      addEvent(room, `☠️ ${target.username} đã bị đầu độc!`);
    }
  }

  room.nightActions    = {};
  room._resolvingNight = false;
  room.round++;
  // #7: lưu lastNightDeaths để reconnect có thể restore
  room.lastNightDeaths = deaths;

  const hunterDeath = deaths.find(d => d.role === 'HUNTER');
  if (hunterDeath) room.pendingHunterShoot = hunterDeath.userId;

  const win = checkWinCondition(room.players);

  await persistRoom(room);
  io.to(code).emit('night_resolved', {
    deaths, events: room.events,
    players: sanitizePlayers(room.players, null, true),
  });

  if (win && !room.pendingHunterShoot) return endGame(room, code, win);

  if (room.pendingHunterShoot) {
    room._afterHunterPhase = 'night_end';
    await persistRoom(room);
    const hunterSocket = io.sockets.sockets.get(
      room.players.find(p => p.userId === room.pendingHunterShoot)?.socketId
    );
    if (hunterSocket) {
      hunterSocket.emit('hunter_must_shoot', {
        players: room.players.filter(p => p.alive).map(p => ({ userId:p.userId, username:p.username })),
      });
    }
    setTimeout(async () => {
      const r = await cache.getRoom(code);
      if (r?.pendingHunterShoot) {
        r.pendingHunterShoot = null; r._afterHunterPhase = null;
        r.phase = 'discuss'; r.votes = {};
        await persistRoom(r);
        await emitPhaseChanged(code, r, 'discuss', r.round, r.config.discussTime);
        scheduleVote(r, code);
      }
    }, 30000);
    return;
  }

  room.phase = 'discuss'; room.votes = {};
  await persistRoom(room);
  await emitPhaseChanged(code, room, 'discuss', room.round, room.config.discussTime);
  scheduleVote(room, code);
}

// ── Night timeout: nếu hết giờ mà vẫn chưa resolve (dân thường không có action) ──
function scheduleNight(room, code) {
  const roundAtSchedule = room.round;
  const duration = (room.config.nightTime || 30) * 1000 + 3000; // +3s buffer
  setTimeout(async () => {
    const r = await cache.getRoom(code);
    if (!r || r.phase !== 'night' || r.round !== roundAtSchedule) return;
    // BUG E FIX: kiểm tra _resolvingNight từ Redis (đã persist trước đó)
    if (r._resolvingNight) return;

    const aliveSeer   = r.players.find(p => p.alive && p.role === 'SEER');
    const aliveDoctor = r.players.find(p => p.alive && p.role === 'DOCTOR');
    const aliveWitch  = r.players.find(p => p.alive && p.role === 'WITCH');
    // Force skip các action chưa có
    if (aliveSeer   && !r.nightActions.SEER)                                         r.nightActions.SEER_SKIP   = true;
    if (aliveDoctor && !r.nightActions.DOCTOR)                                       r.nightActions.DOCTOR_SKIP = true;
    if (aliveWitch  && !r.nightActions.WITCH_SAVE && !r.nightActions.WITCH_POISON)   r.nightActions.WITCH_SKIP  = true;
    // Wolf không cần skip — nếu không attack thì đêm đó không có nạn nhân

    r._resolvingNight = true;
    await persistRoom(r); // flush trước khi resolve để tránh double trigger
    await resolveNight(r, code);
  }, duration);
}

function scheduleVote(room, code) {
  const roundAtSchedule = room.round;
  setTimeout(async () => {
    const r = await cache.getRoom(code);
    if (r && r.phase === 'discuss' && r.round === roundAtSchedule) {
      const voteTime = r.config.voteTime || 60;
      r.phase = 'vote'; r.votes = {};
      await persistRoom(r);
      await emitPhaseChanged(code, r, 'vote', r.round, voteTime);
      const voteRound = r.round;
      setTimeout(async () => {
        const r2 = await cache.getRoom(code);
        if (r2 && r2.phase === 'vote' && r2.round === voteRound && !r2._resolvingVote) {
          r2._resolvingVote = true;
          await persistRoom(r2);
          await resolveVote(r2, code);
        }
      }, voteTime * 1000);
    }
  }, room.config.discussTime * 1000);
}

async function resolveVote(room, code) {
  room._resolvingVote = false; // reset để vòng vote tiếp theo dùng được
  const tally = {};
  Object.values(room.votes).forEach(v => { tally[v] = (tally[v] || 0) + 1; });
  let maxVotes = 0, executed = null, tie = false;
  for (const [uid, cnt] of Object.entries(tally)) {
    if (cnt > maxVotes) { maxVotes = cnt; executed = uid; tie = false; }
    else if (cnt === maxVotes) { tie = true; }
  }
  if (tie) executed = null;

  let execInfo = null;
  if (executed) {
    const target = room.players.find(p => p.userId === executed);
    if (target && target.alive) {
      if (target.role === 'IDIOT' && !target.idiotRevealed) {
        target.idiotRevealed = true;
        execInfo = { spared:true, userId:target.userId, username:target.username, role:target.role };
        addEvent(room, `🤪 ${target.username} là Kẻ Ngốc! Được tha và mất quyền bỏ phiếu.`);
      } else {
        target.alive = false;
        execInfo = { userId:target.userId, username:target.username, role:target.role, votes:maxVotes };
        addEvent(room, `⚖️ ${target.username} (${ROLES[target.role]?.name}) bị treo cổ với ${maxVotes} phiếu.`);
        if (target.role === 'WOLF_KING') room.pendingWolfKingKill = target.userId;
        if (target.role === 'HUNTER')   room.pendingHunterShoot  = target.userId;
      }
    }
  } else {
    addEvent(room, '🤝 Hòa phiếu — không ai bị treo cổ hôm nay.');
  }

  room.votes = {};
  await persistRoom(room);

  io.to(code).emit('vote_resolved', {
    executed: execInfo, events: room.events,
    players: sanitizePlayers(room.players, null, true),
  });

  const winBeforeSpecial = checkWinCondition(room.players);

  if (room.pendingWolfKingKill) {
    room._afterHunterPhase = 'vote_end';
    await persistRoom(room);
    const wkSocket = io.sockets.sockets.get(
      room.players.find(p => p.userId === room.pendingWolfKingKill)?.socketId
    );
    if (wkSocket) {
      wkSocket.emit('wolf_king_must_choose', {
        players: room.players.filter(p => p.alive).map(p => ({ userId:p.userId, username:p.username })),
      });
    }
    setTimeout(async () => {
      const r = await cache.getRoom(code);
      if (r?.pendingWolfKingKill) {
        r.pendingWolfKingKill = null;
        r.phase = 'night'; r.nightActions = {}; r._resolvingNight = false;
        await persistRoom(r);
        await emitPhaseChanged(code, r, 'night', r.round, r.config.nightTime);
        scheduleNight(r, code);
      }
    }, 30000);
    return;
  }

  if (room.pendingHunterShoot) {
    room._afterHunterPhase = 'vote_end';
    await persistRoom(room);
    const hSocket = io.sockets.sockets.get(
      room.players.find(p => p.userId === room.pendingHunterShoot)?.socketId
    );
    if (hSocket) {
      hSocket.emit('hunter_must_shoot', {
        players: room.players.filter(p => p.alive).map(p => ({ userId:p.userId, username:p.username })),
      });
    }
    setTimeout(async () => {
      const r = await cache.getRoom(code);
      if (r?.pendingHunterShoot) {
        r.pendingHunterShoot = null;
        r.phase = 'night'; r.nightActions = {}; r._resolvingNight = false;
        await persistRoom(r);
        await emitPhaseChanged(code, r, 'night', r.round, r.config.nightTime);
        scheduleNight(r, code);
      }
    }, 30000);
    return;
  }

  if (winBeforeSpecial) return endGame(room, code, winBeforeSpecial);

  room.phase = 'night'; room.nightActions = {}; room._resolvingNight = false;
  await persistRoom(room);
  await emitPhaseChanged(code, room, 'night', room.round, room.config.nightTime);
  scheduleNight(room, code);
}

async function endGame(room, code, win) {
  room.phase = 'ended';
  await persistRoom(room);
  try {
    await db.saveGame(code, win.winner, room.players, room.round, room.startedAt || new Date());
  } catch (err) { console.error('saveGame error:', err.message); }

  const revealed = room.players.map(p => ({ ...p, roleInfo:ROLES[p.role] }));
  io.to(code).emit('game_ended', { winner:win.winner, reason:win.reason, players:revealed, events:room.events });

  // Reset phòng sau 5 phút (không emit room_reset ngay — để client tự xem kết quả)
  // Client sẽ gọi play_again hoặc leave_room để thoát
  setTimeout(async () => {
    const r = await cache.getRoom(code);
    if (r && r.phase === 'ended') {
      r.phase = 'waiting';
      r.players.forEach(p => { p.alive=true; p.role=null; p.ready=false; p.idiotRevealed=false; });
      r.round=0; r.events=[]; r.chat=[];
      r.wolfChat=[]; r.lastNightDeaths=[];
      r.witchUsed={ save:false, poison:false }; r.doctorLastSaved=null;
      r.nightActions={}; r.votes={};
      r.pendingHunterShoot=null; r.pendingWolfKingKill=null;
      r._resolvingNight=false; r._afterHunterPhase=null;
      r._resolvingVote=false; r.phaseStartedAt=null; r.phaseDuration=null;
      await persistRoom(r);
      io.to(code).emit('room_reset', sanitizeRoom(r, null));
    }
  }, 5 * 60 * 1000); // 5 phút
}

async function handleLeave(socket, code, userId, isDisconnect = false) {
  const room = await cache.getRoom(code);
  if (!room) return;
  const player = room.players.find(p => p.userId === userId);
  if (!player) return;

  if (isDisconnect) {
    if (player.socketId !== socket.id) return;
    // Mobile app background / lock screen may close the transport. Keep the room slot
    // and let the client resume through auth when the socket reconnects.
    player.socketId = null;
    await persistRoom(room);
    io.to(code).emit('player_offline', { userId, username:player.username });
    if (room.phase === 'waiting') io.to(code).emit('room_updated', sanitizeRoom(room, null));
    return;
  }

  room.players = room.players.filter(p => p.userId !== userId);
  socket.leave(code);

  // Clear userRoom mapping của người vừa rời
  await cache.setUserRoom(userId, null);

  if (room.players.length === 0) {
    await cache.deleteRoom(code);
    await cache.removeActiveRoom(code);
    return;
  }

  if (room.hostId === userId) {
    const next = room.players.find(p => p.socketId) || room.players[0];
    room.hostId = next.userId; room.hostName = next.username;
    io.to(code).emit('host_changed', { newHostId:room.hostId, newHostName:room.hostName });
  }

  await persistRoom(room);
  io.to(code).emit('player_left', { userId, username:player.username });
  io.to(code).emit('room_updated', sanitizeRoom(room, null));
  if (!isDisconnect) {
    io.to(code).emit('chat_message', { system:true, text:`${player.username} đã rời phòng`, ts:Date.now() });
  }
}

async function closeRoom(code, room, reason) {
  io.to(code).emit('room_closed', { reason });
  await Promise.all(room.players.map(p => cache.setUserRoom(p.userId, null)));
  await cache.deleteRoom(code);
  await cache.removeActiveRoom(code);
  io.in(code).socketsLeave(code);
}

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
waitForServices()
  .then(() => server.listen(PORT, '0.0.0.0', () => console.log(`🐺 Ma Sói server on port ${PORT}`)))
  .catch(err => { console.error('Failed to start:', err.message); process.exit(1); });

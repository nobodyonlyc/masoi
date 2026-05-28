const { io } = require('../client/node_modules/socket.io-client');

const SERVER = process.env.SERVER_URL || 'http://localhost:3001';
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
let userSeq = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

class AssertionError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

function assert(condition, message, details) {
  if (!condition) throw new AssertionError(message, details);
}

async function api(path, options = {}) {
  const res = await fetch(`${SERVER}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

function once(socket, event, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for ${event}`));
    }, timeout);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      socket.off('error', onError);
    };
    const onEvent = payload => {
      cleanup();
      resolve(payload);
    };
    const onError = payload => {
      cleanup();
      reject(new Error(`socket error while waiting for ${event}: ${payload?.msg || JSON.stringify(payload)}`));
    };
    socket.on(event, onEvent);
    socket.on('error', onError);
  });
}

function waitForEvent(client, event, predicate = () => true, timeout = 6000) {
  const existing = client.events.find(e => e.event === event && predicate(e.payload));
  if (existing) return Promise.resolve(existing.payload);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for ${event}`));
    }, timeout);
    const cleanup = () => {
      clearTimeout(timer);
      client.socket.off(event, onEvent);
      client.socket.off('error', onError);
    };
    const onEvent = payload => {
      if (!predicate(payload)) return;
      cleanup();
      resolve(payload);
    };
    const onError = payload => {
      cleanup();
      reject(new Error(`socket error while waiting for ${event}: ${payload?.msg || JSON.stringify(payload)}`));
    };
    client.socket.on(event, onEvent);
    client.socket.on('error', onError);
  });
}

async function expectSocketError(client, action, includes, timeout = 1500) {
  const before = client.errors.length;
  action();
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = client.errors.slice(before).find(msg => msg.includes(includes));
    if (found) return found;
    await wait(40);
  }
  throw new AssertionError(`expected socket error containing "${includes}"`, {
    errors: client.errors.slice(before),
  });
}

async function registerUser(testName, index) {
  const username = `e2e${RUN.slice(-6)}${(userSeq++).toString(36)}`.slice(0, 20);
  const password = 'pass1234';
  const data = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return { id: data.userId, username: data.username, password };
}

async function connectUser(user) {
  const socket = io(SERVER, {
    transports: ['polling', 'websocket'],
    timeout: 10000,
    reconnection: false,
    withCredentials: false,
  });
  await once(socket, 'connect');
  const client = { ...user, socket, events: [], errors: [], role: null, wolves: [], room: null };
  wireClient(client);
  socket.emit('auth', { userId: user.id, username: user.username });
  return client;
}

function wireClient(client) {
  const events = [
    'room_created',
    'room_joined',
    'room_updated',
    'role_assigned',
    'game_started',
    'phase_changed',
    'wolf_target_updated',
    'witch_peek_result',
    'seer_result',
    'night_resolved',
    'votes_updated',
    'vote_resolved',
    'hunter_must_shoot',
    'hunter_shot',
    'wolf_king_must_choose',
    'wolf_king_dragged',
    'game_ended',
    'room_reset',
    'wolf_message',
    'chat_message',
    'player_online',
    'player_offline',
  ];
  for (const event of events) {
    client.socket.on(event, payload => {
      client.events.push({ event, payload });
      if (event === 'role_assigned') {
        client.role = payload.role;
        client.wolves = payload.wolves || [];
      }
      if (event === 'room_created' || event === 'room_joined') client.room = payload.room;
      if (event === 'room_updated' || event === 'room_reset') client.room = payload;
    });
  }
  client.socket.on('error', payload => {
    client.errors.push(payload?.msg || JSON.stringify(payload));
  });
}

function disconnectAll(clients) {
  for (const client of clients) {
    if (client.socket.connected) client.socket.disconnect();
  }
}

function byRole(clients, role) {
  return clients.find(c => c.role === role);
}

function allWolves(clients) {
  return clients.filter(c => ['WOLF', 'WOLF_KING'].includes(c.role));
}

function nonWolf(clients, except = new Set()) {
  return clients.find(c => !['WOLF', 'WOLF_KING'].includes(c.role) && !except.has(c.id));
}

function aliveFrom(players, id) {
  return players.find(p => p.userId === id);
}

async function createStartedRoom(testName, roles, config = {}) {
  const users = [];
  for (let i = 0; i < roles.length; i++) users.push(await registerUser(testName, i));
  const clients = [];
  for (const user of users) clients.push(await connectUser(user));

  const host = clients[0];
  const createPromise = once(host.socket, 'room_created');
  host.socket.emit('create_room', {
    userId: host.id,
    username: host.username,
    roomName: `E2E ${testName}`,
    isPrivate: true,
    config: {
      maxPlayers: roles.length,
      discussTime: config.discussTime ?? 1,
      nightTime: config.nightTime ?? 2,
      voteTime: config.voteTime ?? 2,
      roles,
    },
  });
  const { code } = await createPromise;

  for (const client of clients.slice(1)) {
    const joinPromise = once(client.socket, 'room_joined');
    client.socket.emit('join_room', { code, userId: client.id, username: client.username });
    await joinPromise;
  }
  for (const client of clients.slice(1)) {
    client.socket.emit('toggle_ready', { code, userId: client.id });
    await wait(40);
  }

  const gameStarted = Promise.all(clients.map(c => waitForEvent(c, 'game_started')));
  host.socket.emit('start_game', { code, userId: host.id });
  await gameStarted;
  await Promise.all(clients.map(c => waitForEvent(c, 'role_assigned')));
  await Promise.all(clients.map(c => waitForEvent(c, 'phase_changed', p => p.phase === 'night')));

  return { code, clients };
}

async function skipIfCan(client, code) {
  if (['WOLF', 'WOLF_KING', 'SEER', 'DOCTOR', 'WITCH'].includes(client.role)) {
    client.socket.emit('night_skip', { code, userId: client.id });
  }
}

async function finishNightWithSkips(clients, code, excludeIds = new Set()) {
  for (const client of clients) {
    if (!excludeIds.has(client.id)) {
      await skipIfCan(client, code);
      await wait(30);
    }
  }
  return waitForEvent(clients[0], 'night_resolved', () => true, 6000);
}

async function waitVotePhase(clients) {
  await Promise.all(clients.map(c => waitForEvent(c, 'phase_changed', p => p.phase === 'vote', 5000).catch(() => null)));
}

function castVotes(voters, code, targetId) {
  for (const voter of voters) {
    if (voter.id !== targetId) voter.socket.emit('cast_vote', { code, userId: voter.id, targetId });
  }
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('role distribution defaults for 6 and 10 players', async () => {
  const six = await createStartedRoom('dist6', ['WOLF', 'WOLF', 'SEER', 'DOCTOR', 'VILLAGER', 'VILLAGER']);
  const sixCounts = countRoles(six.clients);
  assert(sixCounts.WOLF === 2 && sixCounts.SEER === 1 && sixCounts.DOCTOR === 1, '6-player distribution mismatch', sixCounts);
  disconnectAll(six.clients);

  const ten = await createStartedRoom('dist10', ['WOLF_KING', 'WOLF', 'WOLF', 'SEER', 'DOCTOR', 'WITCH', 'HUNTER', 'IDIOT', 'VILLAGER', 'VILLAGER']);
  const tenCounts = countRoles(ten.clients);
  assert(tenCounts.WOLF_KING === 1 && tenCounts.WOLF === 2 && tenCounts.IDIOT === 1, '10-player distribution mismatch', tenCounts);
  disconnectAll(ten.clients);
});

test('wolves share realtime target and cannot bite teammate', async () => {
  const { code, clients } = await createStartedRoom('wolf', ['WOLF', 'WOLF', 'SEER', 'DOCTOR', 'VILLAGER', 'VILLAGER']);
  const wolves = allWolves(clients);
  const victim1 = nonWolf(clients);
  const victim2 = nonWolf(clients, new Set([victim1.id]));
  assert(wolves.length === 2 && victim1 && victim2, 'missing wolf scenario actors', { roles: countRoles(clients) });

  await expectSocketError(wolves[0], () => {
    wolves[0].socket.emit('night_action', { code, userId: wolves[0].id, targetId: wolves[1].id });
  }, 'đồng bọn');

  wolves[0].socket.emit('night_action', { code, userId: wolves[0].id, targetId: victim1.id });
  await waitForEvent(wolves[1], 'wolf_target_updated', p => p?.targetId === victim1.id);
  wolves[1].socket.emit('night_action', { code, userId: wolves[1].id, targetId: victim2.id });
  await waitForEvent(wolves[0], 'wolf_target_updated', p => p?.targetId === victim2.id);

  await finishNightWithSkips(clients, code, new Set(wolves.map(w => w.id)));
  const resolved = clients[0].events.find(e => e.event === 'night_resolved').payload;
  assert(resolved.deaths.some(d => d.userId === victim2.id), 'last wolf target did not die', resolved);
  disconnectAll(clients);
});

test('wolf skip clears target and produces no wolf death', async () => {
  const { code, clients } = await createStartedRoom('wolfskip', ['WOLF', 'WOLF', 'SEER', 'DOCTOR', 'VILLAGER', 'VILLAGER']);
  const wolf = allWolves(clients)[0];
  const victim = nonWolf(clients);
  wolf.socket.emit('night_action', { code, userId: wolf.id, targetId: victim.id });
  await waitForEvent(wolf, 'wolf_target_updated', p => p?.targetId === victim.id);
  wolf.socket.emit('night_skip', { code, userId: wolf.id });
  await waitForEvent(wolf, 'wolf_target_updated', p => p === null);
  const resolved = await finishNightWithSkips(clients, code);
  assert(resolved.deaths.length === 0, 'wolf skip still caused death', resolved);
  disconnectAll(clients);
});

test('seer only receives wolf boolean', async () => {
  const { code, clients } = await createStartedRoom('seer', ['WOLF', 'SEER', 'DOCTOR', 'VILLAGER']);
  const seer = byRole(clients, 'SEER');
  const wolf = byRole(clients, 'WOLF');
  const villager = byRole(clients, 'VILLAGER') || byRole(clients, 'DOCTOR');
  seer.socket.emit('night_action', { code, userId: seer.id, targetId: wolf.id });
  const wolfResult = await waitForEvent(seer, 'seer_result', r => r.targetId === wolf.id);
  assert(wolfResult.isWolf === true && !('role' in wolfResult), 'seer wolf result leaked wrong data', wolfResult);
  seer.socket.emit('night_action', { code, userId: seer.id, targetId: villager.id });
  const villageResult = await waitForEvent(seer, 'seer_result', r => r.targetId === villager.id);
  assert(villageResult.isWolf === false && !('role' in villageResult), 'seer village result leaked wrong data', villageResult);
  disconnectAll(clients);
});

test('doctor can self-save and cannot save same target next night', async () => {
  const { code, clients } = await createStartedRoom('doctor', ['WOLF', 'SEER', 'DOCTOR', 'VILLAGER']);
  const wolf = byRole(clients, 'WOLF');
  const doctor = byRole(clients, 'DOCTOR');
  wolf.socket.emit('night_action', { code, userId: wolf.id, targetId: doctor.id });
  doctor.socket.emit('night_action', { code, userId: doctor.id, targetId: doctor.id });
  const resolved = await finishNightWithSkips(clients, code, new Set([wolf.id, doctor.id]));
  assert(!resolved.deaths.some(d => d.userId === doctor.id), 'doctor self-save failed', resolved);
  await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'vote');
  await wait(2500);
  await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'night');
  await expectSocketError(doctor, () => {
    doctor.socket.emit('night_action', { code, userId: doctor.id, targetId: doctor.id });
  }, '2 đêm liên tiếp');
  disconnectAll(clients);
});

test('witch save, poison, and restrictions', async () => {
  const saveRoom = await createStartedRoom('witchsave', ['WOLF', 'SEER', 'DOCTOR', 'WITCH', 'VILLAGER']);
  {
    const { code, clients } = saveRoom;
    const wolf = byRole(clients, 'WOLF');
    const witch = byRole(clients, 'WITCH');
    const victim = byRole(clients, 'VILLAGER') || byRole(clients, 'SEER');
    await expectSocketError(witch, () => {
      witch.socket.emit('night_action', { code, userId: witch.id, action: 'save', targetId: witch.id });
    }, 'chính mình');
    wolf.socket.emit('night_action', { code, userId: wolf.id, targetId: victim.id });
    witch.socket.emit('witch_peek', { code, userId: witch.id });
    const peek = await waitForEvent(witch, 'witch_peek_result', p => p.attackedId === victim.id);
    assert(peek.canSave === true && peek.canPoison === true, 'witch peek missing potion availability', peek);
    witch.socket.emit('night_action', { code, userId: witch.id, action: 'save', targetId: victim.id });
    await expectSocketError(witch, () => {
      witch.socket.emit('night_action', { code, userId: witch.id, action: 'poison', targetId: wolf.id });
    }, 'tối đa 1 hành động');
    const resolved = await finishNightWithSkips(clients, code, new Set([wolf.id, witch.id]));
    assert(!resolved.deaths.some(d => d.userId === victim.id), 'witch save failed', resolved);
    disconnectAll(clients);
  }

  const poisonRoom = await createStartedRoom('witchpoison', ['WOLF', 'SEER', 'DOCTOR', 'WITCH', 'VILLAGER']);
  {
    const { code, clients } = poisonRoom;
    const witch = byRole(clients, 'WITCH');
    const target = byRole(clients, 'VILLAGER') || byRole(clients, 'SEER');
    await expectSocketError(witch, () => {
      witch.socket.emit('night_action', { code, userId: witch.id, action: 'poison', targetId: witch.id });
    }, 'tự độc');
    witch.socket.emit('night_action', { code, userId: witch.id, action: 'poison', targetId: target.id });
    const resolved = await finishNightWithSkips(clients, code, new Set([witch.id]));
    assert(resolved.deaths.some(d => d.userId === target.id && d.cause === 'poison'), 'witch poison failed', resolved);
    disconnectAll(clients);
  }
});

test('hunter shoots after wolf kill and vote hanging', async () => {
  const nightRoom = await createStartedRoom('hunternight', ['WOLF', 'SEER', 'DOCTOR', 'HUNTER', 'VILLAGER']);
  {
    const { code, clients } = nightRoom;
    const wolf = byRole(clients, 'WOLF');
    const hunter = byRole(clients, 'HUNTER');
    const target = byRole(clients, 'VILLAGER') || byRole(clients, 'SEER');
    wolf.socket.emit('night_action', { code, userId: wolf.id, targetId: hunter.id });
    const resolved = await finishNightWithSkips(clients, code, new Set([wolf.id]));
    assert(resolved.deaths.some(d => d.userId === hunter.id), 'hunter did not die at night setup', resolved);
    await waitForEvent(hunter, 'hunter_must_shoot');
    hunter.socket.emit('hunter_shoot', { code, userId: hunter.id, targetId: target.id });
    const shot = await waitForEvent(clients[0], 'hunter_shot', p => p.targetId === target.id);
    assert(shot.targetId === target.id, 'hunter shot wrong target', shot);
    disconnectAll(clients);
  }

  const voteRoom = await createStartedRoom('huntervote', ['WOLF', 'SEER', 'DOCTOR', 'HUNTER', 'VILLAGER']);
  {
    const { code, clients } = voteRoom;
    await finishNightWithSkips(clients, code);
    await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'vote');
    const hunter = byRole(clients, 'HUNTER');
    const target = byRole(clients, 'VILLAGER') || byRole(clients, 'SEER');
    castVotes(clients.filter(c => c.id !== hunter.id), code, hunter.id);
    await waitForEvent(hunter, 'hunter_must_shoot');
    hunter.socket.emit('hunter_shoot', { code, userId: hunter.id, targetId: target.id });
    const shot = await waitForEvent(clients[0], 'hunter_shot', p => p.targetId === target.id);
    assert(shot.targetId === target.id, 'hunter vote shot wrong target', shot);
    disconnectAll(clients);
  }
});

test('wolf king drags only after hanging, not poison', async () => {
  const hangRoom = await createStartedRoom('wkhang', ['WOLF_KING', 'WOLF', 'SEER', 'DOCTOR', 'VILLAGER']);
  {
    const { code, clients } = hangRoom;
    await finishNightWithSkips(clients, code);
    await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'vote');
    const wk = byRole(clients, 'WOLF_KING');
    const target = nonWolf(clients, new Set([wk.id]));
    castVotes(clients.filter(c => c.id !== wk.id), code, wk.id);
    await waitForEvent(wk, 'wolf_king_must_choose');
    wk.socket.emit('wolf_king_target', { code, userId: wk.id, targetId: target.id });
    const dragged = await waitForEvent(clients[0], 'wolf_king_dragged', p => p.targetId === target.id);
    assert(dragged.targetId === target.id, 'wolf king dragged wrong target', dragged);
    disconnectAll(clients);
  }

  const poisonRoom = await createStartedRoom('wkpoison', ['WOLF_KING', 'WOLF', 'SEER', 'DOCTOR', 'WITCH', 'VILLAGER']);
  {
    const { code, clients } = poisonRoom;
    const wk = byRole(clients, 'WOLF_KING');
    const witch = byRole(clients, 'WITCH');
    witch.socket.emit('night_action', { code, userId: witch.id, action: 'poison', targetId: wk.id });
    const resolved = await finishNightWithSkips(clients, code, new Set([witch.id]));
    assert(resolved.deaths.some(d => d.userId === wk.id && d.cause === 'poison'), 'wolf king poison setup failed', resolved);
    assert(!wk.events.some(e => e.event === 'wolf_king_must_choose'), 'wolf king was prompted after poison death');
    disconnectAll(clients);
  }
});

test('idiot survives first hanging, reveals, and cannot vote after', async () => {
  const { code, clients } = await createStartedRoom('idiot', ['WOLF', 'SEER', 'DOCTOR', 'IDIOT', 'VILLAGER']);
  await finishNightWithSkips(clients, code);
  await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'vote');
  const idiot = byRole(clients, 'IDIOT');
  castVotes(clients.filter(c => c.id !== idiot.id), code, idiot.id);
  const vote = await waitForEvent(clients[0], 'vote_resolved', p => p.executed?.spared);
  const revealed = vote.players.find(p => p.userId === idiot.id);
  assert(revealed.alive === true && revealed.idiotRevealed === true && revealed.role === 'IDIOT', 'idiot did not survive/reveal', vote);
  await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'night');
  await finishNightWithSkips(clients, code);
  await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'vote');
  const target = nonWolf(clients, new Set([idiot.id]));
  idiot.socket.emit('cast_vote', { code, userId: idiot.id, targetId: target.id });
  await wait(300);
  const latestVotes = clients[0].events.filter(e => e.event === 'votes_updated').at(-1)?.payload?.votes || {};
  assert(!latestVotes[idiot.id], 'revealed idiot vote was counted', latestVotes);
  disconnectAll(clients);
});

test('vote tie hangs nobody', async () => {
  const { code, clients } = await createStartedRoom('tie', ['WOLF', 'SEER', 'DOCTOR', 'VILLAGER']);
  await finishNightWithSkips(clients, code);
  await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'vote');
  const alive = clients;
  alive[0].socket.emit('cast_vote', { code, userId: alive[0].id, targetId: alive[1].id });
  alive[1].socket.emit('cast_vote', { code, userId: alive[1].id, targetId: alive[0].id });
  alive[2].socket.emit('cast_vote', { code, userId: alive[2].id, targetId: alive[3].id });
  alive[3].socket.emit('cast_vote', { code, userId: alive[3].id, targetId: alive[2].id });
  const vote = await waitForEvent(clients[0], 'vote_resolved', () => true, 5000);
  assert(vote.executed === null, 'tie vote executed someone', vote);
  disconnectAll(clients);
});

test('win conditions for village and wolf', async () => {
  const village = await createStartedRoom('villagewin', ['WOLF', 'SEER', 'DOCTOR', 'VILLAGER']);
  {
    const { code, clients } = village;
    await finishNightWithSkips(clients, code);
    await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'vote');
    const wolf = byRole(clients, 'WOLF');
    castVotes(clients.filter(c => c.id !== wolf.id), code, wolf.id);
    const ended = await waitForEvent(clients[0], 'game_ended', p => p.winner === 'village');
    assert(ended.winner === 'village', 'village win failed', ended);
    disconnectAll(clients);
  }

  const wolfWin = await createStartedRoom('wolfwin', ['WOLF', 'SEER', 'DOCTOR', 'VILLAGER']);
  {
    const { code, clients } = wolfWin;
    const wolf = byRole(clients, 'WOLF');
    const victim = byRole(clients, 'VILLAGER') || byRole(clients, 'SEER');
    wolf.socket.emit('night_action', { code, userId: wolf.id, targetId: victim.id });
    await finishNightWithSkips(clients, code, new Set([wolf.id]));
    await waitForEvent(clients[0], 'phase_changed', p => p.phase === 'vote');
    const nonWolves = clients.filter(c => !['WOLF', 'WOLF_KING'].includes(c.role) && c.id !== victim.id);
    const target = nonWolves[0];
    castVotes(clients.filter(c => c.id !== target.id && c.id !== victim.id), code, target.id);
    const ended = await waitForEvent(clients[0], 'game_ended', p => p.winner === 'wolf', 6000);
    assert(ended.winner === 'wolf', 'wolf win failed', ended);
    disconnectAll(clients);
  }
});

test('reconnect restores role, phase, wolf target, pending hunter, and ended result', async () => {
  const room = await createStartedRoom('resume', ['WOLF', 'SEER', 'DOCTOR', 'HUNTER', 'VILLAGER']);
  const { code, clients } = room;
  const wolf = byRole(clients, 'WOLF');
  const hunter = byRole(clients, 'HUNTER');
  wolf.socket.emit('night_action', { code, userId: wolf.id, targetId: hunter.id });
  await waitForEvent(wolf, 'wolf_target_updated', p => p?.targetId === hunter.id);

  wolf.socket.disconnect();
  const wolfReconnected = await connectUser({ id: wolf.id, username: wolf.username, password: wolf.password });
  await waitForEvent(wolfReconnected, 'role_assigned', p => p.role === 'WOLF');
  await waitForEvent(wolfReconnected, 'phase_changed', p => p.phase === 'night');
  await waitForEvent(wolfReconnected, 'wolf_target_updated', p => p?.targetId === hunter.id);
  wolf.socket = wolfReconnected.socket;
  wolf.events = wolfReconnected.events;
  wolf.errors = wolfReconnected.errors;

  const resolved = await finishNightWithSkips(clients, code, new Set([wolf.id]));
  assert(resolved.deaths.some(d => d.userId === hunter.id), 'hunter was not killed for pending resume setup', resolved);
  await waitForEvent(hunter, 'hunter_must_shoot');
  hunter.socket.disconnect();
  const hunterReconnected = await connectUser({ id: hunter.id, username: hunter.username, password: hunter.password });
  await waitForEvent(hunterReconnected, 'hunter_must_shoot');
  const target = byRole(clients, 'VILLAGER') || byRole(clients, 'SEER');
  hunterReconnected.socket.emit('hunter_shoot', { code, userId: hunter.id, targetId: target.id });
  await waitForEvent(clients[0], 'hunter_shot', p => p.targetId === target.id);

  disconnectAll(clients);
  hunterReconnected.socket.disconnect();

  const endedRoom = await createStartedRoom('resumeend', ['WOLF', 'SEER', 'DOCTOR', 'VILLAGER']);
  {
    const endClients = endedRoom.clients;
    const endCode = endedRoom.code;
    await finishNightWithSkips(endClients, endCode);
    await waitForEvent(endClients[0], 'phase_changed', p => p.phase === 'vote');
    const endWolf = byRole(endClients, 'WOLF');
    castVotes(endClients.filter(c => c.id !== endWolf.id), endCode, endWolf.id);
    await waitForEvent(endClients[0], 'game_ended', p => p.winner === 'village');
    endClients[1].socket.disconnect();
    const re = await connectUser({ id: endClients[1].id, username: endClients[1].username, password: endClients[1].password });
    const ended = await waitForEvent(re, 'game_ended', p => p.winner === 'village');
    assert(ended.winner === 'village', 'ended result did not resume', ended);
    disconnectAll(endClients);
    re.socket.disconnect();
  }
});

function countRoles(clients) {
  return clients.reduce((acc, c) => {
    acc[c.role] = (acc[c.role] || 0) + 1;
    return acc;
  }, {});
}

async function run() {
  console.log(`SERVER=${SERVER}`);
  await api('/health');
  const results = [];
  for (const t of tests) {
    const start = Date.now();
    try {
      await t.fn();
      results.push({ name: t.name, status: 'PASS', ms: Date.now() - start });
      console.log(`PASS ${t.name}`);
    } catch (err) {
      results.push({
        name: t.name,
        status: 'FAIL',
        ms: Date.now() - start,
        error: err.message,
        details: err.details,
      });
      console.error(`FAIL ${t.name}: ${err.message}`);
      if (err.details) console.error(JSON.stringify(err.details, null, 2));
    }
    await wait(200);
  }
  const failed = results.filter(r => r.status === 'FAIL');
  console.log(JSON.stringify({ summary: { total: results.length, failed: failed.length }, results }, null, 2));
  if (failed.length) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

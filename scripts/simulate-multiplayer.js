const { io } = require('../client/node_modules/socket.io-client');

const SERVER = process.env.SERVER_URL || 'http://localhost:3001';
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function once(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for ${event}`));
    }, timeout);
    const cleanup = () => {
      clearTimeout(t);
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

function emitAckless(socket, event, payload) {
  socket.emit(event, payload);
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

async function registerUser(index) {
  const username = `sim_${RUN}_${index}`;
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
  await once(socket, 'connect', 5000);
  socket.emit('auth', { userId: user.id, username: user.username });
  return { ...user, socket, events: [], errors: [], role: null, wolves: [], room: null };
}

function wireLogs(client) {
  const logEvents = [
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
  for (const event of logEvents) {
    client.socket.on(event, payload => {
      client.events.push({ event, payload });
      if (event === 'role_assigned') {
        client.role = payload.role;
        client.wolves = payload.wolves || [];
      }
      if (event === 'room_created' || event === 'room_joined' || event === 'room_updated' || event === 'room_reset') {
        client.room = payload.room || payload;
      }
    });
  }
  client.socket.on('error', payload => {
    client.errors.push(payload?.msg || JSON.stringify(payload));
  });
}

async function createRoom(host, config) {
  const p = once(host.socket, 'room_created');
  host.socket.emit('create_room', {
    userId: host.id,
    username: host.username,
    roomName: `Sim ${RUN}`,
    isPrivate: false,
    config,
  });
  const { code, room } = await p;
  host.room = room;
  return code;
}

async function joinRoom(client, code) {
  const p = once(client.socket, 'room_joined');
  client.socket.emit('join_room', { code, userId: client.id, username: client.username });
  const { room } = await p;
  client.room = room;
}

async function startGame(host, code) {
  const p = Promise.all([
    once(host.socket, 'game_started'),
    once(host.socket, 'phase_changed'),
  ]);
  host.socket.emit('start_game', { code, userId: host.id });
  await p;
}

function aliveTargets(players, excludeIds = new Set()) {
  return players.filter(p => p.alive && !excludeIds.has(p.userId));
}

function clientByRole(clients, role) {
  return clients.find(c => c.role === role);
}

function clientsByWolf(clients) {
  return clients.filter(c => ['WOLF', 'WOLF_KING'].includes(c.role));
}

async function scenarioSixPlayers() {
  const users = [];
  for (let i = 0; i < 6; i++) users.push(await registerUser(i));
  const clients = [];
  for (const user of users) {
    const client = await connectUser(user);
    wireLogs(client);
    clients.push(client);
  }

  const code = await createRoom(clients[0], {
    maxPlayers: 6,
    discussTime: 2,
    nightTime: 2,
    voteTime: 2,
  });
  for (const client of clients.slice(1)) await joinRoom(client, code);
  for (const client of clients.slice(1)) {
    client.socket.emit('toggle_ready', { code, userId: client.id });
    await wait(120);
  }
  await wait(300);
  await startGame(clients[0], code);
  await wait(500);

  const roleCounts = clients.reduce((acc, c) => {
    acc[c.role] = (acc[c.role] || 0) + 1;
    return acc;
  }, {});

  const wolves = clientsByWolf(clients);
  const seer = clientByRole(clients, 'SEER');
  const doctor = clientByRole(clients, 'DOCTOR');
  const witch = clientByRole(clients, 'WITCH');
  const latestRoom = clients[0].events.findLast?.(e => e.event === 'game_started')?.payload;
  const players = latestRoom?.players || clients[0].room?.players || [];
  const wolfIds = new Set(wolves.map(w => w.id));
  const wolfTargets = aliveTargets(players, wolfIds);

  const firstTarget = wolfTargets[0];
  const secondTarget = wolfTargets[1] || wolfTargets[0];
  if (wolves[0] && firstTarget) {
    wolves[0].socket.emit('night_action', { code, userId: wolves[0].id, targetId: firstTarget.userId });
  }
  await wait(200);
  if (wolves[1] && secondTarget) {
    wolves[1].socket.emit('night_action', { code, userId: wolves[1].id, targetId: secondTarget.userId });
  }
  await wait(200);

  if (seer) {
    const target = wolfTargets.find(p => p.userId !== seer.id) || players.find(p => p.userId !== seer.id);
    if (target) seer.socket.emit('night_action', { code, userId: seer.id, targetId: target.userId });
  }
  if (doctor) {
    doctor.socket.emit('night_action', { code, userId: doctor.id, targetId: doctor.id });
  }
  if (witch) {
    witch.socket.emit('night_skip', { code, userId: witch.id });
  }

  await wait(4500);

  const nightResolved = clients[0].events.find(e => e.event === 'night_resolved')?.payload;
  const wolfTargetUpdates = wolves.map(w => w.events.filter(e => e.event === 'wolf_target_updated').map(e => e.payload));

  for (const client of clients) client.socket.disconnect();

  return {
    name: 'six-player baseline',
    code,
    roleCounts,
    wolves: wolves.map(w => ({ username: w.username, role: w.role })),
    wolfTargetUpdates,
    nightResolved,
    errors: clients.flatMap(c => c.errors.map(error => ({ username: c.username, error }))),
  };
}

async function scenarioReadyRace() {
  const users = [];
  for (let i = 30; i < 36; i++) users.push(await registerUser(i));
  const clients = [];
  for (const user of users) {
    const client = await connectUser(user);
    wireLogs(client);
    clients.push(client);
  }
  const code = await createRoom(clients[0], {
    maxPlayers: 6,
    discussTime: 2,
    nightTime: 2,
    voteTime: 2,
  });
  for (const client of clients.slice(1)) await joinRoom(client, code);
  for (const client of clients.slice(1)) client.socket.emit('toggle_ready', { code, userId: client.id });
  await wait(300);
  clients[0].socket.emit('start_game', { code, userId: clients[0].id });
  await wait(500);
  const latestRoom = clients[0].events.filter(e => e.event === 'room_updated').at(-1)?.payload || clients[0].room;
  const ready = latestRoom?.players?.map(p => ({ username: p.username, ready: p.ready })) || [];
  const errors = clients.flatMap(c => c.errors.map(error => ({ username: c.username, error })));
  for (const client of clients) client.socket.disconnect();
  return {
    name: 'simultaneous ready race',
    code,
    ready,
    errors,
  };
}

async function scenarioWolfSkipClearsTarget() {
  const users = [];
  for (let i = 10; i < 16; i++) users.push(await registerUser(i));
  const clients = [];
  for (const user of users) {
    const client = await connectUser(user);
    wireLogs(client);
    clients.push(client);
  }

  const code = await createRoom(clients[0], {
    maxPlayers: 6,
    discussTime: 2,
    nightTime: 2,
    voteTime: 2,
  });
  for (const client of clients.slice(1)) await joinRoom(client, code);
  for (const client of clients.slice(1)) {
    client.socket.emit('toggle_ready', { code, userId: client.id });
    await wait(120);
  }
  await wait(300);
  await startGame(clients[0], code);
  await wait(500);

  const wolves = clientsByWolf(clients);
  const players = clients[0].events.find(e => e.event === 'game_started')?.payload?.players || [];
  const wolfIds = new Set(wolves.map(w => w.id));
  const target = aliveTargets(players, wolfIds)[0];
  if (wolves[0] && target) {
    wolves[0].socket.emit('night_action', { code, userId: wolves[0].id, targetId: target.userId });
    await wait(200);
    wolves[0].socket.emit('night_skip', { code, userId: wolves[0].id });
  }

  for (const c of clients) {
    if (c.role === 'SEER' || c.role === 'DOCTOR' || c.role === 'WITCH') {
      c.socket.emit('night_skip', { code, userId: c.id });
    }
  }
  await wait(4500);
  const nightResolved = clients[0].events.find(e => e.event === 'night_resolved')?.payload;
  const wolfUpdates = wolves[0]?.events.filter(e => e.event === 'wolf_target_updated').map(e => e.payload) || [];
  for (const client of clients) client.socket.disconnect();

  return {
    name: 'wolf skip clears target',
    code,
    target: target && { userId: target.userId, username: target.username },
    wolfUpdates,
    nightResolved,
    errors: clients.flatMap(c => c.errors.map(error => ({ username: c.username, error }))),
  };
}

async function scenarioVoteRace() {
  const users = [];
  for (let i = 40; i < 44; i++) users.push(await registerUser(i));
  const clients = [];
  for (const user of users) {
    const client = await connectUser(user);
    wireLogs(client);
    clients.push(client);
  }
  const code = await createRoom(clients[0], {
    maxPlayers: 4,
    discussTime: 1,
    nightTime: 1,
    voteTime: 2,
  });
  for (const client of clients.slice(1)) await joinRoom(client, code);
  for (const client of clients.slice(1)) {
    client.socket.emit('toggle_ready', { code, userId: client.id });
    await wait(120);
  }
  await startGame(clients[0], code);
  await wait(500);
  for (const c of clients) {
    if (['WOLF', 'WOLF_KING', 'SEER', 'DOCTOR', 'WITCH'].includes(c.role)) {
      c.socket.emit('night_skip', { code, userId: c.id });
      await wait(80);
    }
  }
  await wait(2500);
  const players = clients[0].events.filter(e => e.event === 'night_resolved').at(-1)?.payload?.players || [];
  const alive = players.filter(p => p.alive);
  const target = alive.find(p => p.userId !== clients[0].id) || alive[0];
  if (target) {
    for (const c of clients) {
      const p = alive.find(x => x.userId === c.id);
      if (p && p.userId !== target.userId) c.socket.emit('cast_vote', { code, userId: c.id, targetId: target.userId });
    }
  }
  await wait(500);
  const voteUpdates = clients[0].events.filter(e => e.event === 'votes_updated').map(e => e.payload.votes);
  const latestVotes = voteUpdates.at(-1) || {};
  const errors = clients.flatMap(c => c.errors.map(error => ({ username: c.username, error })));
  for (const client of clients) client.socket.disconnect();
  return {
    name: 'simultaneous vote race',
    code,
    target: target && { userId: target.userId, username: target.username },
    voteUpdateCounts: voteUpdates.map(v => Object.keys(v).length),
    latestVoteCount: Object.keys(latestVotes).length,
    errors,
  };
}

async function scenarioTenPlayersDistribution() {
  const users = [];
  for (let i = 20; i < 30; i++) users.push(await registerUser(i));
  const clients = [];
  for (const user of users) {
    const client = await connectUser(user);
    wireLogs(client);
    clients.push(client);
  }
  const code = await createRoom(clients[0], {
    maxPlayers: 10,
    discussTime: 2,
    nightTime: 2,
    voteTime: 2,
  });
  for (const client of clients.slice(1)) await joinRoom(client, code);
  for (const client of clients.slice(1)) {
    client.socket.emit('toggle_ready', { code, userId: client.id });
    await wait(120);
  }
  await wait(500);
  await startGame(clients[0], code);
  await wait(500);
  const roleCounts = clients.reduce((acc, c) => {
    acc[c.role] = (acc[c.role] || 0) + 1;
    return acc;
  }, {});
  for (const client of clients) client.socket.disconnect();
  return {
    name: 'ten-player distribution',
    code,
    roleCounts,
    errors: clients.flatMap(c => c.errors.map(error => ({ username: c.username, error }))),
  };
}

async function main() {
  console.log(`SERVER=${SERVER}`);
  const health = await api('/health');
  console.log('health', health);

  const results = [];
  results.push(await scenarioReadyRace());
  results.push(await scenarioSixPlayers());
  results.push(await scenarioWolfSkipClearsTarget());
  results.push(await scenarioVoteRace());
  results.push(await scenarioTenPlayersDistribution());

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://masoi:masoi_secret@localhost:5432/masoi',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('PostgreSQL pool error:', err));

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// ── Users ──────────────────────────────────────────────────────────────────────

async function createUser(username, passwordHash) {
  const res = await query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username`,
    [username, passwordHash]
  );
  if (res.rowCount === 0) return null; // username taken
  const user = res.rows[0];
  await query('INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
  return user;
}

async function findUser(username) {
  const res = await query(
    'SELECT u.id, u.username, u.password_hash, s.games_played, s.games_won FROM users u LEFT JOIN user_stats s ON s.user_id = u.id WHERE LOWER(u.username) = LOWER($1)',
    [username]
  );
  return res.rows[0] || null;
}

async function getUserStats(userId) {
  const res = await query('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

async function updateUserStats(userId, won, role) {
  const team = ['WOLF', 'WOLF_KING'].includes(role) ? 'wolf' : 'village';
  await query(
    `INSERT INTO user_stats (user_id, games_played, games_won, games_wolf, games_village, wolf_wins, village_wins)
     VALUES ($1, 1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       games_played = user_stats.games_played + 1,
       games_won    = user_stats.games_won + $2,
       games_wolf   = user_stats.games_wolf + $3,
       games_village= user_stats.games_village + $4,
       wolf_wins    = user_stats.wolf_wins + $5,
       village_wins = user_stats.village_wins + $6,
       updated_at   = NOW()`,
    [
      userId,
      won ? 1 : 0,
      team === 'wolf' ? 1 : 0,
      team === 'village' ? 1 : 0,
      (team === 'wolf' && won) ? 1 : 0,
      (team === 'village' && won) ? 1 : 0,
    ]
  );
}

// ── Game history ───────────────────────────────────────────────────────────────

async function saveGame(roomCode, winnerTeam, players, rounds, startedAt) {
  const gameRes = await query(
    `INSERT INTO game_history (room_code, winner_team, player_count, rounds, started_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [roomCode, winnerTeam, players.length, rounds, startedAt]
  );
  const gameId = gameRes.rows[0].id;

  for (const p of players) {
    const team = ['WOLF', 'WOLF_KING'].includes(p.role) ? 'wolf' : 'village';
    const won = team === winnerTeam;
    await query(
      `INSERT INTO game_players (game_id, user_id, username, role, team, survived, won)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [gameId, p.userId || null, p.username, p.role || 'VILLAGER', team, p.alive, won]
    );
    if (p.userId) await updateUserStats(p.userId, won, p.role);
  }
  return gameId;
}

async function getUserGames(userId, limit = 20) {
  const res = await query(
    `SELECT gh.id, gh.room_code, gh.winner_team, gh.player_count, gh.rounds,
            gh.started_at, gh.ended_at,
            gp.role, gp.team, gp.survived, gp.won
     FROM game_history gh
     JOIN game_players gp ON gp.game_id = gh.id
     WHERE gp.user_id = $1
     ORDER BY gh.ended_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return res.rows;
}

async function getLeaderboard(limit = 10) {
  const res = await query(
    `SELECT u.username, s.games_played, s.games_won,
       CASE WHEN s.games_played > 0 THEN ROUND(s.games_won::numeric / s.games_played * 100) ELSE 0 END AS win_pct
     FROM user_stats s JOIN users u ON u.id = s.user_id
     WHERE s.games_played > 0
     ORDER BY win_pct DESC, s.games_played DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function testConnection() {
  await query('SELECT 1');
  console.log('✅ PostgreSQL connected');
}

module.exports = { createUser, findUser, getUserStats, saveGame, getUserGames, getLeaderboard, testConnection };

# Socket.IO Event Contract

## Client to Server

- `auth`: `{ userId, username }`
  - Server should bind socket to user and resume active room if one exists.
- `create_room`: `{ userId, username, config, roomName, isPrivate }`
- `join_room`: `{ code, userId, username }`
- `toggle_ready`: `{ code, userId }`
- `update_config`: `{ code, userId, config }`
- `start_game`: `{ code, userId }`
- `night_action`: `{ code, userId, action, targetId }`
- `witch_peek`: `{ code, userId }`
- `night_skip`: `{ code, userId }`
- `cast_vote`: `{ code, userId, targetId }`
- `hunter_shoot`: `{ code, userId, targetId }`
- `wolf_king_target`: `{ code, userId, targetId }`
- `send_message`: `{ code, userId, username, text, channel }`
- `leave_room`: `{ code, userId }`
- `play_again`: `{ code, userId }`
- `kick_player`: `{ code, userId, targetId }`

## Server to Client

- `room_created`: `{ code, room }`
- `room_joined`: `{ code, room }`
- `room_updated`: `room`
- `role_assigned`: `{ role, roleInfo, wolves }`
  - `wolves` is only sent to wolf-team players.
- `game_started`: `{ players, round }`
- `phase_changed`: `{ phase, round, duration }`
- `wolf_target_updated`: `null | { targetId, targetName, selectedBy, selectedByName, selectedAt }`
- `witch_peek_result`: `{ attackedId, attackedName, canSave, canPoison }`
- `seer_result`: `{ targetId, targetName, isWolf }`
- `night_resolved`: `{ deaths, events, players }`
- `votes_updated`: `{ votes }`
- `vote_resolved`: `{ executed, events, players }`
- `hunter_must_shoot`: `{ players }`
- `hunter_shot`: `{ hunterId, hunterName, targetId, targetName, targetRole, events, players }`
- `wolf_king_must_choose`: `{ players }`
- `wolf_king_dragged`: `{ wkId, wkName, targetId, targetName, targetRole, events, players }`
- `player_offline`: `{ userId, username }`
- `player_online`: `{ userId, username }`
- `game_ended`: `{ winner, reason, players, events }`
- `room_reset`: `room`
- `chat_message`: `message`
- `wolf_message`: `message`
- `kicked`: `{ reason }`
- `error`: `{ msg }`

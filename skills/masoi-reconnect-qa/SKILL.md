---
name: masoi-reconnect-qa
description: Review and test Ma Sói reconnect, F5 refresh, browser back, socket disconnect, resume room, stale room mapping, leave old room, and play-again recovery flows. Use when changing auth, user-room Redis mapping, disconnect handling, room_joined resume, phase timer restoration, or room reset behavior.
---

# Ma Sói Reconnect QA

## Workflow

1. Read `server/index.js` handlers: `auth`, `join_room`, `disconnect`, `leave_room`, `play_again`, `handleLeave`.
2. Read Redis helpers in `server/db/redis.js`: socket-user mapping and user-room mapping.
3. Read client boot/resume logic in `client/src/App.jsx`, `client/src/hooks/useSocket.jsx`, and `client/src/hooks/useGame.js`.
4. Check behavior against `references/reconnect-checklist.md`.
5. For code changes, verify:
   - `node --check server/index.js`
   - `cd client && npm run build` if client changed.

## Required Resume Payloads

On reconnect after `auth`, server should restore:

- `room_joined` with sanitized room.
- `role_assigned` if game already started.
- `phase_changed` with remaining time.
- Special state where relevant, such as `wolf_target_updated` and `night_resolved`.
- Online/offline indicators to other players.

## Failure Signals

- User sees lobby while still mapped to a room.
- User cannot create/join because stale `user:{id}:room` points to missing Redis room.
- Refresh during night loses role, timer, target, or special prompt.
- Host play-again clears result on one client before server resets room.

## References

Load `references/reconnect-checklist.md` when testing or reviewing reconnect behavior.

---
name: masoi-socket-contract
description: Maintain the Ma Sói Socket.IO contract between server/index.js and client/src/hooks/useGame.js. Use when adding, renaming, removing, or changing payloads for socket events such as room_joined, role_assigned, phase_changed, night_resolved, wolf_target_updated, vote_resolved, room_reset, reconnect/resume, chat, or special-role events.
---

# Ma Sói Socket Contract

## Workflow

1. Find server emits/listeners in `server/index.js`.
2. Find client listeners/actions in `client/src/hooks/useGame.js`.
3. Check UI consumers in `client/src/pages/*` and `client/src/components/*`.
4. Update `references/events.md` when the contract changes.
5. Preserve hidden-information boundaries in payloads.
6. Verify with:
   - `node --check server/index.js`
   - `cd client && npm run build`

## Contract Rules

- Every server `socket.emit` or `io.to(...).emit` used by gameplay must have a matching client listener unless intentionally one-way.
- Every client `socket.emit` action must have a matching server handler.
- Payload changes must be made server-first, then hook state, then UI.
- Reconnect/resume must re-emit enough state to rebuild the current screen.
- Do not expose all player roles to living non-spectator players before the game ends.

## Common Files

- Server handlers: `server/index.js`
- Client socket setup: `client/src/hooks/useSocket.jsx`
- Client game contract/state: `client/src/hooks/useGame.js`
- Main routing by phase: `client/src/App.jsx`

## References

Load `references/events.md` when changing Socket.IO payloads or reconnect behavior.

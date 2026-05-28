---
name: masoi-rules-auditor
description: Audit and update Ma Sói game rules, role balance, win conditions, night/day/vote resolution, and special-role edge cases in this repository. Use when changing server/gameEngine.js, server/index.js phase logic, role assignment, Witch/Doctor/Wolf/Hunter/Wolf King/Idiot behavior, or when reviewing gameplay balance.
---

# Ma Sói Rules Auditor

## Workflow

1. Read `server/gameEngine.js` before changing role counts or role metadata.
2. Read the relevant resolution code in `server/index.js`: `night_action`, `night_skip`, `checkNightComplete`, `resolveNight`, `resolveVote`, `endGame`.
3. Check the change against `references/rules.md`.
4. Verify server and client still agree on hidden information:
   - Dead roles may be revealed.
   - Own role is visible.
   - Wolf teammates are visible only to wolves.
   - Seer gets only wolf / not-wolf, not exact village role.
5. After edits, run at least:
   - `node --check server/index.js`
   - `node --check server/gameEngine.js`
   - `cd client && npm run build` when client code changed.

## Review Checklist

- Wolf count is `4-5 => 1`, `6-9 => 2`, `10+ => 3`.
- `WOLF_KING` does not appear by default before 10 players.
- Wolves share one night target and the last valid target wins.
- Doctor can self-save, cannot save the same target two nights in a row, and never learns the wolf target.
- Witch can use at most one action per night, cannot self-save, cannot self-poison, and save only applies to the wolf target.
- Hunter can shoot after dying by wolf, poison, or hanging.
- Wolf King drags only when hanged by vote.
- Idiot survives first hanging, reveals role, and loses future voting rights.
- Win condition remains: village wins when all wolves die; wolves win when living wolves are at least living non-wolves.

## References

Load `references/rules.md` when a task touches role behavior, phase resolution, role balance, or gameplay edge cases.

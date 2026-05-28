---
name: masoi-ui-review
description: Review or improve Ma Sói UI for phase clarity, role visibility, hidden-information safety, target selection, timers, chat, reconnect state, mobile layout, and game-result screens. Use when editing client/src/pages, client/src/components, client/src/hooks/useGame.js, or user-facing text for roles and actions.
---

# Ma Sói UI Review

## Workflow

1. Read phase routing in `client/src/App.jsx`.
2. Read state contract in `client/src/hooks/useGame.js`.
3. Inspect relevant page/component:
   - `NightPhase.jsx` for role actions.
   - `DayPhase.jsx` and `PlayerGrid.jsx` for vote/day.
   - `WaitingRoom.jsx` for room config.
   - `ResultScreen.jsx` for reveal/end game.
4. Check UI against `references/ui-checklist.md`.
5. Build after edits: `cd client && npm run build`.

## UI Rules

- Show the player's own role clearly in every active phase.
- Do not reveal hidden roles through target filtering, labels, or spectator data.
- For wolves, show teammates and current shared target.
- For Doctor, make self-save clear by labeling self as `(Bạn)`.
- For Witch, show potion availability and one-action-per-night rule.
- Disable or hide impossible actions instead of relying only on server errors.
- Timer labels and configured durations must match server phase timing.
- Keep buttons readable on mobile; avoid overlapping fixed elements.

## References

Load `references/ui-checklist.md` when reviewing or changing UI.

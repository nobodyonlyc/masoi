---
name: masoi-gameplay-qa
description: Generate manual QA scenarios and acceptance checks for Ma Sói gameplay across player counts, role setups, night actions, vote resolution, special roles, timers, chat, and end-game history. Use before or after gameplay changes to define concrete test rooms and expected outcomes.
---

# Ma Sói Gameplay QA

## Workflow

1. Identify touched behavior: role setup, night action, vote, special role, chat, history, reconnect, or UI.
2. Select scenarios from `references/scenarios.md`.
3. Write expected socket/UI/server outcomes before testing.
4. Prefer small deterministic rooms for manual checks:
   - 4 players for basic loop.
   - 6 players for 2-wolf baseline.
   - 7-9 players for Witch/Hunter balance.
   - 10 players for Wolf King default.
5. After code changes, run:
   - `node --check server/index.js`
   - `node --check server/gameEngine.js`
   - `cd client && npm run build`

## QA Output Format

When asked for a test plan, return:

- Scope
- Setup
- Steps
- Expected result
- Regression risks

Keep scenarios executable by a developer using multiple browser tabs.

## References

Load `references/scenarios.md` when creating or running gameplay QA scenarios.

# UI Checklist

## Night

- Role card is visible.
- First-night role reveal modal is understandable and dismissible.
- Wolf target list excludes wolf teammates using `wolfTeam`, not hidden `p.role`.
- Wolf team list shows names and wolf roles.
- Current wolf target updates realtime.
- Doctor can select self and sees `(Bạn)`.
- Witch sees attacked target after peek.
- Witch save button is unavailable when no target is attacked or save potion is used.
- Witch poison button is unavailable after poison potion is used.

## Day and Vote

- Alive/dead status is clear.
- Revealed Idiot is visible and cannot vote.
- Vote tally does not imply hidden roles.
- Offline players are marked without blocking valid game actions.

## Waiting Room

- Host-only controls are visually distinct.
- `maxPlayers`, `discussTime`, `nightTime`, and `voteTime` match server config.
- Ready count treats host as ready.

## Result

- All roles are revealed only after game end.
- Play again waits for server reset.
- Leave room returns to lobby cleanly.

## Responsive

- No fixed footer/topbar overlaps primary actions on mobile.
- Text labels fit in buttons and cards.

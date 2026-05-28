# Gameplay Scenarios

## Role Distribution

- 4 players: 1 wolf, seer, villagers as configured.
- 6 players: 2 wolves, seer, doctor, villagers.
- 7 players: 2 wolves, seer, doctor, witch, villagers.
- 8 players: 2 wolves, seer, doctor, witch, villagers.
- 9 players: 2 wolves, seer, doctor, witch, hunter, villagers.
- 10 players: 3 wolves including Wolf King by default.

## Night

- Wolf selects target; another wolf changes it; last target dies unless saved.
- Wolf cannot select teammate.
- Seer inspects wolf and non-wolf; result is boolean only.
- Doctor self-saves; next night cannot save same target.
- Witch sees wolf target; save works only on that target.
- Witch poison kills living target.
- Witch cannot save and poison in same night.
- Witch cannot self-save or self-poison.

## Day and Vote

- Discussion timer transitions to vote.
- Vote timer uses room config.
- Tie vote hangs nobody.
- Idiot survives first hanging, reveals, and cannot vote after.
- Wolf King hanged by vote can drag a living target.
- Hunter hanged can shoot a living target.

## End Game

- Village wins when no wolves remain.
- Wolves win when living wolves are at least living non-wolves.
- Game history saves winner, roles, survival, and user stats.
- Play again resets to waiting only after `room_reset`.

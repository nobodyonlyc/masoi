# Ma Sói Rule Contract

## Default Role Setup

- 4-5 players: 1 `WOLF`.
- 6-9 players: 2 `WOLF`.
- 10+ players: 3 wolves, with `WOLF_KING` allowed by default.
- Custom role configs may include `WOLF_KING` earlier, but must still keep wolves below half the room.

## Wolves

- `WOLF` and `WOLF_KING` are wolf team.
- Each night, the wolf team has one shared target.
- Any living wolf may choose or change the target during night.
- The final valid target before night resolution is attacked.
- Wolves cannot target wolf teammates.
- Living wolves should see current shared target realtime.

## Seer

- May inspect one living target per night.
- Result is boolean: wolf or not wolf.
- Do not reveal exact non-wolf role.

## Doctor

- May protect one living target per night.
- May protect self.
- Cannot protect the same target in two consecutive nights.
- Does not know who wolves attacked.
- Can act every night while alive.

## Witch

- Has one save potion and one poison potion per game.
- Knows the current wolf target.
- May use at most one action per night: save, poison, or skip.
- Cannot save self.
- Cannot poison self.
- Save can only be used on the current wolf target.

## Hunter

- If killed by wolf, poison, or hanging, may shoot one living target.
- Cannot shoot dead players.

## Wolf King

- Acts as a wolf at night.
- If hanged during vote, may drag one living target to death.
- Does not drag when killed at night or by poison.

## Idiot

- If hanged for the first time, survives, reveals as `IDIOT`, and loses voting rights.
- Still participates in discussion.
- Dies normally to wolf or poison.

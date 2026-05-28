# Ma Sói Online - Game Logic, Roles, Rules, Events

Tài liệu này mô tả logic gameplay hiện tại của source `masoi`: phase flow, behavior role, rule xử lý thắng thua, hidden information, và các sự kiện Socket.IO chính.

## 1. Tổng Quan Kiến Trúc Gameplay

Game là multiplayer realtime qua Socket.IO.

- Server giữ state phòng trong Redis.
- PostgreSQL chỉ lưu user, thống kê, lịch sử ván.
- Client không tự quyết định luật game, chỉ gửi action và render state server trả về.
- Luật game chính nằm ở:
  - `server/gameEngine.js`: metadata role, chia role, win condition.
  - `server/index.js`: room lifecycle, socket handlers, phase scheduler, night/vote resolution.
  - `client/src/hooks/useGame.js`: nhận event realtime và cập nhật UI state.

## 2. Room State

Một room có các nhóm dữ liệu chính:

```js
{
  code,
  name,
  hostId,
  hostName,
  private,
  config,
  players,
  phase,
  round,
  nightActions,
  votes,
  witchUsed,
  doctorLastSaved,
  events,
  chat,
  wolfChat,
  startedAt,
  phaseStartedAt,
  phaseDuration,
  lastNightDeaths,
  pendingHunterShoot,
  pendingWolfKingKill,
  _resolvingNight,
  _resolvingVote
}
```

### `config`

```js
{
  maxPlayers,
  discussTime,
  nightTime,
  voteTime,
  roles
}
```

- `maxPlayers`: số người tối đa.
- `discussTime`: thời gian thảo luận ban ngày.
- `nightTime`: thời gian ban đêm.
- `voteTime`: thời gian bỏ phiếu.
- `roles`: custom role list nếu host cấu hình riêng.

### `players`

```js
{
  userId,
  username,
  socketId,
  alive,
  ready,
  role,
  muted,
  idiotRevealed
}
```

### Hidden Information

Client không được tự đoán role của người khác.

Rule reveal:

- Người chơi luôn thấy role của chính mình.
- Sói thấy danh sách đồng đội Sói.
- Role người chết có thể được reveal.
- `IDIOT` bị treo lần đầu thì sống và bị reveal.
- Khi game kết thúc, toàn bộ role được reveal.
- Tiên Tri chỉ nhận kết quả `isWolf`, không nhận exact role.

## 3. Phase Flow

Phase chính:

```txt
waiting -> night -> discuss -> vote -> night -> ... -> ended
```

### `waiting`

Room đang chờ người chơi.

Behavior:

- Host tạo phòng.
- Người chơi join room bằng mã phòng.
- Người chơi không phải host cần ready.
- Host có thể chỉnh config.
- Host có thể kick người chơi.
- Host start game khi đủ điều kiện.

Điều kiện start:

- Host là người gọi `start_game`.
- Ít nhất 4 người.
- Phase hiện tại là `waiting`.
- Tất cả người chơi trừ host đã ready.

### `night`

Ban đêm, các role có skill hành động.

Role có action:

- `WOLF`
- `WOLF_KING`
- `SEER`
- `DOCTOR`
- `WITCH`

Role không có action đêm:

- `VILLAGER`
- `HUNTER`
- `IDIOT`

Night kết thúc khi:

- Tất cả role có action đã chọn hoặc skip.
- Hoặc hết timer `nightTime`, server force skip các action còn thiếu.

### `discuss`

Ban ngày để thảo luận sau khi đêm resolve.

Behavior:

- Public chat được bật.
- Người sống được chat.
- Người chết không gửi public chat trong lúc game đang chơi.
- Sau `discussTime`, server chuyển sang `vote`.

### `vote`

Người sống vote treo cổ.

Rule:

- Người sống được vote.
- Không được vote chính mình.
- Không được vote người đã chết.
- `IDIOT` đã reveal không được vote.
- Mỗi người chỉ vote một lần.
- Khi tất cả người có quyền vote đã vote, server resolve ngay.
- Nếu chưa đủ vote, hết `voteTime` server tự resolve.

### `ended`

Ván kết thúc.

Behavior:

- Server lưu lịch sử ván vào PostgreSQL.
- Server update stats người chơi.
- Toàn bộ role được reveal.
- Host có thể bấm chơi lại.
- Client chỉ reset khỏi result screen khi server emit `room_reset`.

## 4. Role Distribution Mặc Định

Rule số Sói mặc định:

```txt
4-5 người   => 1 Sói
6-9 người   => 2 Sói
10+ người   => 3 Sói
```

`WOLF_KING` chỉ xuất hiện mặc định từ 10 người trở lên.

Custom roles vẫn có thể chứa `WOLF_KING`, nhưng server phải sanitize:

- Role list đúng số người.
- Chỉ role hợp lệ.
- Có ít nhất 1 Sói.
- Sói ít hơn nửa số người.
- Tối đa 3 Sói.

Setup recommend:

```txt
6 người:
2 WOLF
1 SEER
1 DOCTOR
2 VILLAGER

7 người:
2 WOLF
1 SEER
1 DOCTOR
1 WITCH
2 VILLAGER

8 người:
2 WOLF
1 SEER
1 DOCTOR
1 WITCH
3 VILLAGER

9 người:
2 WOLF
1 SEER
1 DOCTOR
1 WITCH
1 HUNTER
3 VILLAGER
```

## 5. Win Condition

Server kiểm tra người còn sống.

Village thắng khi:

```txt
Không còn Sói sống.
```

Wolf thắng khi:

```txt
Số Sói sống >= số người không phải Sói sống.
```

Sói gồm:

- `WOLF`
- `WOLF_KING`

## 6. Role Behavior

## 6.1 `WOLF` - Ma Sói

Phe:

```txt
wolf
```

Behavior:

- Mỗi đêm cùng phe Sói chọn 1 người để cắn.
- Dù có nhiều Sói, cả phe chỉ có 1 target chung.
- Mỗi Sói sống có thể chọn hoặc đổi target trong đêm.
- Target cuối cùng trước khi resolve là target bị cắn.
- Nếu Sói chọn bỏ qua sau khi đã có target, target hiện tại bị xóa và đêm đó không có wolf kill.
- Không được cắn đồng đội.
- Biết danh sách Sói khác.
- Thấy realtime target hiện tại của phe Sói.

Night action data:

```js
room.nightActions.WOLF_ATTACK = {
  targetId,
  selectedBy,
  selectedByName,
  selectedAt
}
```

Realtime event:

```js
wolf_target_updated
```

Payload:

```js
null | {
  targetId,
  targetName,
  selectedBy,
  selectedByName,
  selectedAt
}
```

## 6.2 `WOLF_KING` - Sói Chúa

Phe:

```txt
wolf
```

Ban đêm:

- Hành động như Sói thường.
- Biết đồng đội.
- Có thể chọn hoặc đổi target cắn.
- Không được cắn đồng đội.

Passive:

- Nếu bị treo cổ ban ngày, được kéo 1 người còn sống chết theo.
- Chỉ trigger khi bị vote treo cổ.
- Không trigger khi chết ban đêm hoặc chết do độc.

Pending state:

```js
room.pendingWolfKingKill = userId
```

Nếu người chơi không chọn sau timeout, server bỏ qua kéo theo và chuyển phase tiếp.

## 6.3 `VILLAGER` - Dân Làng

Phe:

```txt
village
```

Behavior:

- Không có skill ban đêm.
- Ban ngày thảo luận và vote.
- Thắng khi toàn bộ Sói bị loại.

## 6.4 `SEER` - Tiên Tri

Phe:

```txt
village
```

Behavior:

- Mỗi đêm chọn 1 người còn sống để soi.
- Kết quả chỉ cho biết target có phải Sói hay không.
- Không reveal exact role.

Result:

```js
{
  targetId,
  targetName,
  isWolf
}
```

Examples:

```txt
Soi WOLF       => isWolf: true
Soi WOLF_KING  => isWolf: true
Soi WITCH      => isWolf: false
Soi VILLAGER   => isWolf: false
```

## 6.5 `DOCTOR` - Thầy Thuốc

Phe:

```txt
village
```

Behavior:

- Mỗi đêm chọn 1 người còn sống để bảo vệ.
- Có thể tự cứu.
- Không biết ai bị Sói cắn.
- Không được cứu cùng 1 người trong 2 đêm liên tiếp.
- Có thể dùng skill mỗi đêm cho đến khi chết.

State:

```js
room.nightActions.DOCTOR = targetId
room.doctorLastSaved = targetId
```

Resolve:

- Nếu Doctor chọn đúng người bị Sói cắn, người đó không chết vì Sói.
- Nếu Doctor chọn sai, target bị Sói cắn vẫn chết.

## 6.6 `WITCH` - Phù Thủy

Phe:

```txt
village
```

Potion:

- 1 thuốc cứu.
- 1 thuốc độc.
- Mỗi bình dùng 1 lần trong cả ván.

Behavior:

- Biết ai đang bị Sói cắn trong đêm.
- Mỗi đêm chỉ được dùng tối đa 1 hành động:
  - cứu
  - độc
  - bỏ qua
- Không được tự cứu.
- Không được tự độc.

Thuốc cứu:

- Chỉ cứu được người đang bị Sói cắn.
- Nếu không có wolf target, không dùng được cứu.
- Dùng xong mất thuốc cứu.

Thuốc độc:

- Chọn 1 người còn sống để đầu độc.
- Người bị độc chết trong đêm nếu vẫn sống tại thời điểm resolve.
- Dùng xong mất thuốc độc.

State:

```js
room.witchUsed = {
  save: boolean,
  poison: boolean
}

room.nightActions.WITCH_SAVE = targetId
room.nightActions.WITCH_POISON = targetId
room.nightActions.WITCH_SKIP = true
```

## 6.7 `HUNTER` - Thợ Săn

Phe:

```txt
village
```

Behavior:

- Khi chết, được chọn 1 người còn sống để bắn chết theo.

Trigger:

- Bị Sói cắn.
- Bị Phù Thủy độc.
- Bị treo cổ ban ngày.

Target:

- Phải là người còn sống.
- Không được bắn người đã chết.

Pending state:

```js
room.pendingHunterShoot = userId
```

Nếu Hunter không chọn sau timeout, server bỏ qua bắn và chuyển phase tiếp.

## 6.8 `IDIOT` - Kẻ Ngốc

Phe:

```txt
village
```

Behavior:

- Nếu bị vote treo cổ lần đầu:
  - Không chết.
  - Reveal role là `IDIOT`.
  - Mất quyền vote từ các ngày sau.
- Vẫn được thảo luận.
- Nếu bị Sói cắn hoặc bị độc thì chết bình thường.

State:

```js
player.idiotRevealed = true
```

Vote rule:

```js
alive && !(role === 'IDIOT' && idiotRevealed)
```

## 7. Night Resolution

Input:

```js
room.nightActions
```

Resolve order:

1. Lấy wolf target từ `WOLF_ATTACK`.
2. Doctor cứu:
   - Nếu Doctor target trùng wolf target, wolf target được clear.
   - Cập nhật `doctorLastSaved`.
3. Witch save:
   - Chỉ hợp lệ nếu target là wolf target.
   - Nếu cứu đúng, clear wolf target.
   - Mark `witchUsed.save = true`.
4. Wolf kill:
   - Nếu còn wolf target, target chết vì `wolf`.
5. Witch poison:
   - Nếu target còn sống, target chết vì `poison`.
   - Mark `witchUsed.poison = true`.
6. Clear `nightActions`.
7. Lưu `lastNightDeaths`.
8. Nếu Hunter chết, set `pendingHunterShoot`.
9. Check win condition.
10. Nếu không pending special action, chuyển sang `discuss`.

Death payload:

```js
{
  userId,
  username,
  role,
  cause: 'wolf' | 'poison'
}
```

## 8. Vote Resolution

Input:

```js
room.votes = {
  [voterUserId]: targetUserId
}
```

Resolve:

1. Tally votes.
2. Nếu hòa phiếu, không ai bị treo.
3. Nếu có người cao phiếu nhất:
   - Nếu target là unrevealed `IDIOT`, target sống và reveal.
   - Nếu không, target chết.
4. Nếu target là `WOLF_KING`, set `pendingWolfKingKill`.
5. Nếu target là `HUNTER`, set `pendingHunterShoot`.
6. Check win condition sau special actions.
7. Nếu không end game, chuyển sang `night`.

## 9. Reconnect / Resume

Flow:

1. Client connect hoặc reconnect.
2. Client emit:

```js
auth { userId, username }
```

3. Server kiểm tra Redis `user:{userId}:room`.
4. Nếu room còn tồn tại:
   - Gán `socketId` mới cho player.
   - `socket.join(roomCode)`.
   - Emit `room_joined`.
   - Nếu game đã bắt đầu:
     - Emit `role_assigned`.
     - Emit `phase_changed` với remaining time.
     - Emit `wolf_target_updated` nếu player là Sói.
     - Emit `night_resolved` nếu có `lastNightDeaths`.
     - Emit lại pending prompt nếu player đang cần bắn Hunter hoặc kéo Wolf King.
     - Emit lại `game_ended` nếu room đã kết thúc.
   - Broadcast `player_online`.
5. Nếu mapping trỏ tới room không tồn tại, server clear mapping.

Disconnect:

- Nếu đang chơi, server không remove player khỏi room.
- Server set `socketId = null`.
- Broadcast `player_offline`.
- Nếu toàn bộ người chơi disconnect, server xóa room zombie và clear user-room mapping.

## 10. Chat Rules

Public chat:

- Phase `waiting`: người trong room chat được.
- Phase `night`: người sống không public chat.
- Phase `discuss` và `vote`: người sống public chat được.
- Người chết không gửi public chat khi game đang diễn ra.
- Người chết vẫn nhận message.

Wolf chat:

- Chỉ Sói còn sống gửi được.
- Sói chết vẫn nhận wolf chat.
- Server lưu `wolfChat` để Sói reconnect nhận lại lịch sử wolf chat gần nhất.

## 11. Game Events Log

Server lưu event trong:

```js
room.events
```

Mỗi event:

```js
{
  text,
  ts
}
```

Giới hạn:

```txt
Tối đa 100 events gần nhất.
```

Event log dùng cho:

- Timeline trong game.
- Result screen.
- Spectator view.
- Reconnect restore.

## 12. REST API Events

### `POST /api/register`

Body:

```js
{ username, password }
```

Creates user and default stats.

### `POST /api/login`

Body:

```js
{ username, password }
```

Returns user and stats.

### `GET /api/rooms`

Returns public active rooms not ended.

### `GET /api/room/:code`

Spectator room info.

Hidden info:

- Living players' roles are hidden.
- Dead players' roles are visible.
- Revealed Idiot role is visible.

### `GET /api/leaderboard`

Returns leaderboard by win percentage and games played.

### `GET /api/my-games/:userId`

Returns recent game history for a user.

### `GET /health`

Health check.

## 13. Socket.IO Event Contract

## 13.1 Client -> Server

### `auth`

```js
{ userId, username }
```

Binds socket to user and tries to resume active room.

### `create_room`

```js
{
  userId,
  username,
  config,
  roomName,
  isPrivate
}
```

Creates room and joins creator as host.

### `join_room`

```js
{ code, userId, username }
```

Joins room or reconnects existing player.

### `toggle_ready`

```js
{ code, userId }
```

Toggles ready state in waiting room.

### `update_config`

```js
{ code, userId, config }
```

Host-only. Updates waiting-room config.

### `start_game`

```js
{ code, userId }
```

Host-only. Starts game if valid.

### `night_action`

```js
{ code, userId, action, targetId }
```

Role-specific night action.

`action` is mainly used by Witch:

```txt
save | poison
```

### `witch_peek`

```js
{ code, userId }
```

Witch requests current wolf target and potion availability.

### `night_skip`

```js
{ code, userId }
```

Skips night action.

### `cast_vote`

```js
{ code, userId, targetId }
```

Casts one vote.

### `hunter_shoot`

```js
{ code, userId, targetId }
```

Hunter pending action.

### `wolf_king_target`

```js
{ code, userId, targetId }
```

Wolf King pending drag action.

### `send_message`

```js
{ code, userId, username, text, channel }
```

`channel`:

```txt
public | wolf
```

### `leave_room`

```js
{ code, userId }
```

Leaves room.

### `play_again`

```js
{ code, userId }
```

Host-only. Resets ended room to waiting.

### `kick_player`

```js
{ code, userId, targetId }
```

Host-only in waiting room.

## 13.2 Server -> Client

### `room_created`

```js
{ code, room }
```

### `room_joined`

```js
{ code, room }
```

### `room_updated`

```js
room
```

### `role_assigned`

```js
{
  role,
  roleInfo,
  wolves
}
```

`wolves` chỉ có dữ liệu cho Sói.

### `game_started`

```js
{ players, round }
```

### `phase_changed`

```js
{ phase, round, duration }
```

`duration` là remaining time khi reconnect.

### `wolf_target_updated`

```js
null | {
  targetId,
  targetName,
  selectedBy,
  selectedByName,
  selectedAt
}
```

Chỉ gửi cho Sói.

### `witch_peek_result`

```js
{
  attackedId,
  attackedName,
  canSave,
  canPoison
}
```

### `seer_result`

```js
{
  targetId,
  targetName,
  isWolf
}
```

### `night_resolved`

```js
{
  deaths,
  events,
  players
}
```

### `votes_updated`

```js
{ votes }
```

### `vote_resolved`

```js
{
  executed,
  events,
  players
}
```

### `hunter_must_shoot`

```js
{ players }
```

### `hunter_shot`

```js
{
  hunterId,
  hunterName,
  targetId,
  targetName,
  targetRole,
  events,
  players
}
```

### `wolf_king_must_choose`

```js
{ players }
```

### `wolf_king_dragged`

```js
{
  wkId,
  wkName,
  targetId,
  targetName,
  targetRole,
  events,
  players
}
```

### `player_offline`

```js
{ userId, username }
```

### `player_online`

```js
{ userId, username }
```

### `game_ended`

```js
{
  winner,
  reason,
  players,
  events
}
```

### `room_reset`

```js
room
```

Server confirm room reset after play again.

### `chat_message`

```js
{
  system,
  userId,
  username,
  text,
  ts,
  channel
}
```

### `wolf_message`

```js
{
  userId,
  username,
  text,
  ts,
  channel: 'wolf'
}
```

### `host_changed`

```js
{
  newHostId,
  newHostName
}
```

### `player_left`

```js
{ userId, username }
```

### `kicked`

```js
{ reason }
```

### `error`

```js
{ msg }
```

## 14. Play Again Reset

Khi host bấm chơi lại:

1. Client emit `play_again`.
2. Server kiểm tra phase `ended` và host.
3. Server reset room:
   - `phase = waiting`
   - players alive true
   - roles null
   - ready false
   - `idiotRevealed = false`
   - clear `events`
   - clear `chat`
   - clear `wolfChat`
   - clear `lastNightDeaths`
   - clear `nightActions`
   - clear `votes`
   - reset `witchUsed`
   - reset `doctorLastSaved`
   - clear pending special actions
   - clear resolving flags
   - clear phase timer
4. Server emit `room_reset`.
5. Client clear result screen only when receiving `room_reset`.

## 15. Manual QA Checklist

Minimum scenarios:

- 4-player basic game can start and end.
- 6-player game has 2 wolves.
- 8-player game does not have 3 wolves by default.
- 10-player game can include Wolf King by default.
- Wolves see teammates and current target.
- Wolf target changed by another wolf updates realtime.
- Doctor can self-save.
- Doctor cannot save same player two nights in a row.
- Witch cannot save without wolf target.
- Witch cannot save and poison in the same night.
- Witch cannot self-save or self-poison.
- Seer result is only wolf / not wolf.
- Hunter shoots after dying by wolf, poison, and hanging.
- Wolf King drags only when hanged.
- Idiot survives first hanging and cannot vote later.
- Vote timer uses `voteTime`.
- Refresh during night restores role, phase, timer, and wolf target.
- Refresh during Hunter/Wolf King pending action restores the required action prompt.
- Refresh on result screen restores the result screen.
- Host play again waits for `room_reset`.
